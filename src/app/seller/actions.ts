'use server';

import { z } from 'zod';

const CONNECT_URL = 'https://n8nbeta.typeflow.app.br/webhook/aeb30639-baf0-4862-9f5f-a3cc468ab7c5';
const STATUS_URL = 'https://n8nbeta.typeflow.app.br/webhook/58da289a-e20c-460a-8e35-d01c9b567dad';
const DISCONNECT_URL = 'https://n8nbeta.typeflow.app.br/webhook/2ac86d63-f7fc-4221-bbaf-efeecec33127';
const WELCOME_URL = 'https://n8nbeta.typeflow.app.br/webhook/235c79d0-71ed-4a43-aa3c-5c0cf1de2580';


const tokenSchema = z.string().min(1, "Token é obrigatório");

export async function connectWhatsApp(token: string): Promise<{ qrCode?: string; error?: string }> {
    try {
        tokenSchema.parse(token);

        const response = await fetch(CONNECT_URL, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("WhatsApp Connect API Error:", errorText)
            return { error: `Erro ao conectar: ${response.status} ${errorText}` };
        }
        
        const data = await response.json();
        
        if (data && data.qrcode) {
            let qrCodeString = data.qrcode;
            if (!qrCodeString.startsWith('data:image/')) {
                 qrCodeString = `data:image/png;base64,${qrCodeString}`;
            }
            return { qrCode: qrCodeString };
        }
        
        console.error("Resposta inesperada da API do WhatsApp (Connect):", JSON.stringify(data));
        return { error: 'QR Code não encontrado na resposta da API. Formato inesperado.' };

    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return { error: e.errors[0].message };
        }
        console.error("Exceção ao conectar WhatsApp:", e);
        return { error: `Exceção ao conectar: ${e.message}` };
    }
}


type StatusResponse = {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  profileName?: string;
  profilePicUrl?: string;
  error?: string;
}

export async function checkWhatsAppStatus(token: string): Promise<StatusResponse> {
     try {
        tokenSchema.parse(token);

        const response = await fetch(STATUS_URL, {
            method: 'POST',
            headers: { 
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ token }),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("WhatsApp Status API Error:", errorText);
            return { status: 'disconnected', error: `Erro ao buscar status: ${response.status} ${errorText}` };
        }

        const data = await response.json();
        
        if (!data || typeof data.status === 'undefined') {
             console.error("Resposta inesperada da API do WhatsApp (Status):", JSON.stringify(data));
             return { status: 'disconnected', error: 'Formato de resposta de status inesperado.' };
        }
        
        const effectiveStatus = (data.status || '').trim();

        const validStatuses = ['connected', 'connecting', 'disconnected'];
        if (!validStatuses.includes(effectiveStatus)) {
            console.warn(`Status inesperado recebido: '${effectiveStatus}'. Tratando como 'disconnected'.`);
            return {
                status: 'disconnected',
                profileName: data.nomeperfil,
                profilePicUrl: data.fotoperfil,
            };
        }
        
        return {
            status: effectiveStatus as 'connected' | 'connecting' | 'disconnected',
            profileName: data.nomeperfil,
            profilePicUrl: data.fotoperfil,
        };

    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return { status: 'error', error: e.errors[0].message };
        }
        console.error("Exceção ao buscar status do WhatsApp:", e);
        return { status: 'error', error: `Exceção ao buscar status: ${e.message}` };
    }
}

type DisconnectResponse = {
    success: boolean;
    message?: string;
    error?: string;
}

export async function disconnectWhatsApp(token: string): Promise<DisconnectResponse> {
    try {
        tokenSchema.parse(token);

        const response = await fetch(DISCONNECT_URL, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("WhatsApp Disconnect API Error:", errorText);
            return { success: false, error: `Erro ao desconectar: ${response.status} ${errorText}` };
        }

        const data = await response.json();

        return { success: true, message: data.message || "Desconectado com sucesso." };

    } catch (e: any) {
         if (e instanceof z.ZodError) {
            return { success: false, error: e.errors[0].message };
        }
        console.error("Exceção ao desconectar WhatsApp:", e);
        return { success: false, error: `Exceção ao desconectar: ${e.message}` };
    }
}


/**
 * Cleans and normalizes a message string to be sent via WhatsApp.
 * 1. Replaces all CRLF and CR with LF.
 * 2. Removes any whitespace between consecutive newlines.
 * @param message The raw message string.
 * @returns A cleaned message string.
 */
function normalizeMessageForWhatsapp(message: string): string {
    if (!message) return '';
    // Unify all newline types to \n
    const normalizedNewlines = message.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // Remove any whitespace between two newlines to fix the `\n \n` issue.
    const cleanedMessage = normalizedNewlines.replace(/\n\s*\n/g, '\n\n');
    return cleanedMessage;
}


export async function sendWelcomeWhatsAppMessage(number: string, message: string, token: string): Promise<{ success: boolean; error?: string }> {
    if (!number || !message || !token) {
        return { success: false, error: 'Número, mensagem ou token não fornecidos.' };
    }

    const formattedNumber = `+55${number.replace(/\D/g, '')}`;
    const cleanedMessage = normalizeMessageForWhatsapp(message);

    try {
        const bodyPayload = {
            token: token,
            number: formattedNumber,
            text: cleanedMessage,
        };

        const response = await fetch(WELCOME_URL, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyPayload),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("WhatsApp Welcome API Error:", errorText)
            return { success: false, error: `Erro da API: ${response.status} ${errorText}` };
        }
        
        return { success: true };

    } catch (e: any) {
        console.error("Exceção ao enviar mensagem de boas-vindas:", e);
        return { success: false, error: `Exceção: ${e.message}` };
    }
}


export async function sendTestWhatsAppMessage(message: string, token: string): Promise<{ success: boolean; error?: string }> {
    const testNumber = "77998222827";
    if (!message || !token) {
        return { success: false, error: 'Mensagem ou token não fornecidos.' };
    }

    const formattedNumber = `+55${testNumber.replace(/\D/g, '')}`;
    const cleanedMessage = normalizeMessageForWhatsapp(message);

    try {
        const bodyPayload = {
            token: token,
            number: formattedNumber,
            text: cleanedMessage,
        };

        const response = await fetch(WELCOME_URL, { // Re-using WELCOME_URL as it's a generic webhook endpoint
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyPayload),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("WhatsApp Test Message API Error:", errorText)
            return { success: false, error: `Erro da API de Teste: ${response.status} ${errorText}` };
        }
        
        return { success: true };

    } catch (e: any) {
        console.error("Exceção ao enviar mensagem de teste:", e);
        return { success: false, error: `Exceção: ${e.message}` };
    }
}
