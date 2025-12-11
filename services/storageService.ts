import { Guest, Photo, PixConfig } from '../types';

// ==============================================================================
// CONFIGURAÇÃO DO GOOGLE DRIVE (BACKEND)
// ------------------------------------------------------------------------------
// IMPORTANTE: A URL abaixo deve ser a URL da IMPLANTAÇÃO (WEB APP), não a de edição.
// 1. No Google Apps Script, clique em "Implantar" > "Gerenciar implantações".
// 2. Copie a "URL do app da web" (termina em /exec).
// 3. Cole abaixo.
// ==============================================================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyP19nB5J2oDe4R7vy26sTwIRIvwbLDX3CCprG96sy_TkjP-VF7Ld4bmHQjuCFk09UT/exec"; 

const ADMIN_PASSWORD_KEY = 'wedding_app_admin_password';
const PIX_CONFIG_KEY = 'wedding_app_pix_config';
const COVER_PHOTO_KEY = 'wedding_app_cover_photo';
const ADMIN_SESSION_KEY = 'wedding_app_admin_session';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const StorageService = {
  // --- Guest Methods (Google Sheets Integration) ---
  
  // Agora retorna uma Promise pois busca online
  getGuests: async (): Promise<Guest[]> => {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("/edit")) return [];

    try {
      // Adicionamos ?type=guests para que o script saiba que queremos a lista de convidados
      // O Script deve estar preparado para ler 'e.parameter.type' no doGet
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?type=guests`);
      if (!response.ok) throw new Error("Erro ao buscar convidados");
      
      const data = await response.json();
      
      if (!Array.isArray(data)) return [];

      // Filtra apenas objetos que parecem ser convidados (tem nome e adultos)
      // Isso protege caso o script retorne tudo (fotos e convidados) misturado
      return data
        .filter((item: any) => item.name && (item.adults !== undefined || item.type === 'rsvp'))
        .map((item: any) => ({
          id: item.id || crypto.randomUUID(),
          name: item.name,
          adults: Number(item.adults || 0),
          children: Number(item.children || 0),
          confirmedAt: item.confirmedAt || new Date().toISOString(),
          message: item.message || ''
        }));
    } catch (error) {
      console.error("Erro ao carregar convidados:", error);
      return [];
    }
  },

  addGuest: async (guest: Omit<Guest, 'id' | 'confirmedAt'>): Promise<Guest> => {
    const newGuest: Guest = {
      ...guest,
      id: crypto.randomUUID(),
      confirmedAt: new Date().toISOString(),
    };

    // Payload específico para RSVP
    // O Script deve verificar 'type' ou 'action'
    const payload = {
        type: 'rsvp', // Identificador para o script salvar na aba de convidados
        action: 'addGuest',
        id: newGuest.id,
        name: newGuest.name,
        adults: newGuest.adults,
        children: newGuest.children,
        message: newGuest.message,
        confirmedAt: newGuest.confirmedAt
    };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (result.result === 'error') {
            throw new Error(result.message || "Erro ao salvar na planilha.");
        }

        return newGuest;
    } catch (error) {
        console.error("Erro ao confirmar presença:", error);
        throw new Error("Falha na conexão com a planilha. Tente novamente.");
    }
  },

  deleteGuest: async (id: string): Promise<void> => {
     const payload = {
        action: 'deleteGuest',
        id: id,
        adminPassword: StorageService.getAdminPassword()
    };

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error("Erro ao deletar convidado:", error);
        throw new Error("Erro ao remover da planilha.");
    }
  },

  // --- Photo/Video Methods (GOOGLE DRIVE INTEGRATION) ---
  
  getPhotos: async (): Promise<Photo[]> => {
    // Validação preventiva para evitar erros de CORS/Fetch com URLs erradas
    if (!GOOGLE_SCRIPT_URL || 
        GOOGLE_SCRIPT_URL.includes("COLE_AQUI") || 
        GOOGLE_SCRIPT_URL.includes("/edit") || 
        !GOOGLE_SCRIPT_URL.startsWith("http")) {
        console.warn("StorageService: URL do Google Script não configurada ou inválida. O álbum ficará vazio.");
        return [];
    }

    try {
      // ?type=photos garante que não venha a lista de convidados misturada se o script tratar diferente
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?type=photos`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      
      // Validação básica do formato de resposta
      if (!Array.isArray(data)) {
          // Se o script retornar um erro JSON em vez de array
          if (data.result === 'error') throw new Error(data.message);
          return [];
      }

      // Filtra para garantir que só temos fotos (caso venha misturado)
      return data
        .filter((item: any) => item.image || item.url || item.type === 'image' || item.type === 'video')
        .map((item: any) => ({
        id: item.id,
        url: item.url,
        caption: item.caption,
        uploader: item.uploader,
        comments: [], 
        likes: 0,
        createdAt: item.createdAt,
        type: item.type || 'image'
      }));
    } catch (error) {
      console.error("Erro ao carregar do Drive:", error);
      // Retornar array vazio para não quebrar a UI
      return [];
    }
  },

  addPhoto: async (file: File, caption: string, uploader: string): Promise<Photo> => {
    if (!GOOGLE_SCRIPT_URL || 
        GOOGLE_SCRIPT_URL.includes("COLE_AQUI") || 
        GOOGLE_SCRIPT_URL.includes("/edit")) {
        throw new Error("Erro de Configuração: O administrador precisa configurar a URL do Web App (exec) no código.");
    }

    // Validação de tamanho (10MB)
    if (file.size > 10 * 1024 * 1024) {
        throw new Error("O arquivo é muito grande (Máx 10MB). Tente um vídeo menor ou comprima a imagem.");
    }

    const base64 = await fileToBase64(file);
    const id = crypto.randomUUID();
    const type = file.type.startsWith('video/') ? 'video' : 'image';

    const payload = {
        id: id,
        image: base64,
        caption: caption,
        uploader: uploader,
        type: type,
        action: 'uploadPhoto' // Explicit action
    };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error("Erro na conexão com o servidor.");
        }

        const result = await response.json();
        
        if (result.result !== 'success') {
            throw new Error(result.message || "Erro desconhecido ao salvar.");
        }

        return {
            id: id,
            url: result.url,
            caption,
            uploader,
            comments: [],
            likes: 0,
            createdAt: new Date().toISOString(),
            type: type as 'image' | 'video'
        };

    } catch (error) {
        console.error("Upload falhou:", error);
        throw new Error("Falha no upload. Verifique a conexão.");
    }
  },

  deletePhoto: async (id: string): Promise<Photo[]> => {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("/edit")) {
         throw new Error("URL do Script inválida.");
    }

    // Payload instruindo o script a deletar
    const payload = {
        action: 'delete',
        id: id,
        adminPassword: StorageService.getAdminPassword() // Envia senha caso o script valide segurança
    };

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (result.result === 'error') {
            throw new Error(result.message || "O Script Google retornou erro ao tentar excluir.");
        }

        return StorageService.getPhotos();

    } catch (error) {
        console.error("Delete failed:", error);
        throw new Error("Falha ao excluir do Drive. Verifique se o seu Google Script possui a função de deletar configurada.");
    }
  },

  deletePhotos: async (ids: string[]): Promise<Photo[]> => {
    // Para garantir compatibilidade com scripts simples, deletamos um por um
    const deletePromises = ids.map(id => {
         const payload = {
            action: 'delete',
            id: id,
            adminPassword: StorageService.getAdminPassword()
        };
        return fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    });

    try {
        await Promise.all(deletePromises);
        return StorageService.getPhotos();
    } catch (error) {
        console.error("Bulk delete failed", error);
        throw new Error("Erro ao excluir algumas fotos. Tente novamente.");
    }
  },

  addComment: async (photoId: string, author: string, text: string): Promise<Photo[]> => {
    return StorageService.getPhotos();
  },

  deleteComment: async (photoId: string, commentId: string): Promise<Photo[]> => {
    return StorageService.getPhotos();
  },

  likePhoto: async (photoId: string): Promise<Photo[]> => {
    return StorageService.getPhotos();
  },

  updatePhotoInDB: async (photo: any) => {
    // No-op
  },

  // --- Admin Methods ---
  getAdminPassword: (): string => {
    return localStorage.getItem(ADMIN_PASSWORD_KEY) || 'amor2025';
  },

  setAdminPassword: (password: string): void => {
    localStorage.setItem(ADMIN_PASSWORD_KEY, password);
  },

  loginAdmin: (): void => {
    localStorage.setItem(ADMIN_SESSION_KEY, 'true');
  },

  logoutAdmin: (): void => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  },

  isAdminLoggedIn: (): boolean => {
    return localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
  },

  getCoverPhoto: (): string => {
    return localStorage.getItem(COVER_PHOTO_KEY) || '';
  },

  saveCoverPhoto: async (file: File): Promise<string> => {
     if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("/edit")) {
         throw new Error("URL do Script inválida.");
     }

     const base64 = await fileToBase64(file);
     const id = "COVER_" + Date.now();
     
     const payload = {
        id: id,
        image: base64,
        caption: "FOTO_DE_CAPA_OFICIAL",
        uploader: "Admin",
        type: 'image',
        action: 'uploadPhoto'
     };

     try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Erro HTTP ao salvar capa");

        const result = await response.json();

        if (result.result !== 'success') {
             throw new Error(result.message || "Erro no script ao salvar capa");
        }
        
        localStorage.setItem(COVER_PHOTO_KEY, result.url);
        return result.url;

     } catch (e) {
         console.error("Erro ao salvar capa no drive:", e);
         throw new Error("Falha ao enviar capa para o Drive.");
     }
  },

  // --- PIX Methods ---
  getPixConfig: (): PixConfig => {
    const data = localStorage.getItem(PIX_CONFIG_KEY);
    return data ? JSON.parse(data) : { qrCodeBase64: '', pixKey: '' };
  },

  savePixConfig: (config: PixConfig): void => {
    localStorage.setItem(PIX_CONFIG_KEY, JSON.stringify(config));
  }
};