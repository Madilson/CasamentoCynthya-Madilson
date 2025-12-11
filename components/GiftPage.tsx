import React, { useEffect, useState } from 'react';
import { StorageService } from '../services/storageService';
import { Copy, Gift, Heart } from 'lucide-react';
import { PixConfig } from '../types';

const GiftPage: React.FC = () => {
  const [pixConfig, setPixConfig] = useState<PixConfig>({ qrCodeBase64: '', pixKey: '' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPixConfig(StorageService.getPixConfig());
  }, []);

  const handleCopy = () => {
    if (pixConfig.pixKey) {
      navigator.clipboard.writeText(pixConfig.pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-xl text-center border-t-4 border-pink-500 min-h-[500px] flex flex-col items-center">
      <div className="bg-pink-50 p-4 rounded-full mb-6">
        <Gift className="w-12 h-12 text-pink-600" />
      </div>

      <h2 className="text-3xl font-serif-display text-blue-900 mb-4">Lista de Presentes</h2>
      
      <p className="text-gray-600 mb-8 font-body leading-relaxed">
        Sua presença é nosso maior presente! <br/>
        Mas se desejar nos abençoar com uma lembrança, optamos por uma lista virtual via PIX para nossa lua de mel.
      </p>

      {pixConfig.qrCodeBase64 || pixConfig.pixKey ? (
        <div className="w-full space-y-6">
          {pixConfig.qrCodeBase64 && (
            <div className="flex justify-center">
              <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
                <img 
                  src={pixConfig.qrCodeBase64} 
                  alt="QR Code PIX" 
                  className="w-48 h-48 object-contain"
                />
              </div>
            </div>
          )}

          {pixConfig.pixKey && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Chave PIX</p>
              <div className="flex items-center space-x-2">
                <code className="flex-1 text-sm font-mono text-blue-900 bg-white p-2 rounded border truncate">
                  {pixConfig.pixKey}
                </code>
                <button 
                  onClick={handleCopy}
                  className={`p-2 rounded transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                  title="Copiar Chave"
                >
                  {copied ? <Heart className="w-5 h-5 fill-current" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              {copied && <p className="text-xs text-green-600 mt-2 font-bold">Copiado!</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 bg-gray-50 rounded-lg border border-gray-200 w-full">
            <p className="text-gray-500 italic">Informações do PIX serão adicionadas em breve.</p>
        </div>
      )}

      <div className="mt-auto pt-8">
        <p className="font-script text-3xl text-pink-600">Obrigado pelo carinho!</p>
      </div>
    </div>
  );
};

export default GiftPage;