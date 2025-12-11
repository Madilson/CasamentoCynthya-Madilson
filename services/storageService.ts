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

const GUESTS_KEY = 'wedding_app_guests'; 
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
  // --- Guest Methods ---
  getGuests: (): Guest[] => {
    const data = localStorage.getItem(GUESTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  addGuest: async (guest: Omit<Guest, 'id' | 'confirmedAt'>): Promise<Guest> => {
    await delay(500); 
    const guests = StorageService.getGuests();
    const newGuest: Guest = {
      ...guest,
      id: crypto.randomUUID(),
      confirmedAt: new Date().toISOString(),
    };
    guests.push(newGuest);
    localStorage.setItem(GUESTS_KEY, JSON.stringify(guests));
    return newGuest;
  },

  deleteGuest: (id: string): void => {
    const guests = StorageService.getGuests().filter(g => g.id !== id);
    localStorage.setItem(GUESTS_KEY, JSON.stringify(guests));
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
      const response = await fetch(GOOGLE_SCRIPT_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      
      // Validação básica do formato de resposta
      if (!Array.isArray(data)) {
          // Se o script retornar um erro JSON em vez de array
          if (data.result === 'error') throw new Error(data.message);
          return [];
      }

      return data.map((item: any) => ({
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
        type: type
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
    alert("Para deletar fotos salvas no Drive, remova a linha correspondente na Planilha Google e o arquivo no Drive.");
    return StorageService.getPhotos();
  },

  deletePhotos: async (ids: string[]): Promise<Photo[]> => {
    alert("Delete as fotos diretamente na Planilha/Drive.");
    return StorageService.getPhotos();
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

  // Modificado para salvar no Drive
  saveCoverPhoto: async (file: File): Promise<string> => {
     if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("/edit")) {
         throw new Error("URL do Script inválida.");
     }

     const base64 = await fileToBase64(file);
     // Usamos um ID prefixado para identificar (embora o script salve tudo na mesma pasta)
     const id = "COVER_" + Date.now();
     
     const payload = {
        id: id,
        image: base64,
        caption: "FOTO_DE_CAPA_OFICIAL",
        uploader: "Admin",
        type: 'image'
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
        
        // Salva apenas a URL retornada pelo Drive no LocalStorage
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