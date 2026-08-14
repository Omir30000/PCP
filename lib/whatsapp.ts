export const WHATSAPP_API_URL = 'https://bot-whatsapp-baileys-l1k0.onrender.com/send-message';

export function formatarNumeroWhatsApp(telefone: string): string {
  let number = String(telefone || '').replace(/\D/g, '');
  if (number.startsWith('0')) number = number.substring(1);
  if (!number.startsWith('55') && (number.length === 10 || number.length === 11)) {
    number = '55' + number;
  }
  return number;
}

interface SendWhatsAppParams {
  number: string;
  message: string;
  isGroup?: boolean;
}

export async function sendWhatsAppMessage({ number, message, isGroup = false }: SendWhatsAppParams): Promise<void> {
  const response = await fetch(WHATSAPP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: formatarNumeroWhatsApp(number),
      isGroup,
      message
    })
  });
  if (!response.ok) {
    const erroTexto = await response.text();
    throw new Error(`WhatsApp falhou (${response.status}): ${erroTexto}`);
  }
}
