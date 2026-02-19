'use client';

import { useEffect, useRef } from 'react';
import { useFirestore, useDoc, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { sendWelcomeWhatsAppMessage } from '../seller/actions';
import type { WhatsappConfig, PendingMessage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export function WhatsAppMessageDaemon() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const configDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'configs', 'whatsapp') : null, [firestore]);
    const { data: whatsappConfig } = useDoc<WhatsappConfig>(configDocRef);

    const pendingMessagesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'pending_whatsapp_messages') : null, [firestore]);
    const { data: pendingMessages } = useCollection<PendingMessage>(pendingMessagesQuery);

    const processedIds = useRef(new Set<string>());

    useEffect(() => {
        if (!pendingMessages || pendingMessages.length === 0 || !whatsappConfig?.apiToken) {
            return;
        }

        const { apiToken } = whatsappConfig;

        pendingMessages.forEach(async (msg) => {
            if (processedIds.current.has(msg.id)) {
                return; 
            }

            processedIds.current.add(msg.id);

            let messageTemplate: string | undefined;
            let finalMessage: string = '';

            switch (msg.type) {
                case 'welcome':
                    messageTemplate = whatsappConfig.welcomeMessage;
                    if (messageTemplate) {
                        finalMessage = messageTemplate
                            .replace(/{cliente}/g, msg.data.customerName || '')
                            .replace(/{email}/g, msg.data.customerEmail || '');
                    }
                    break;

                case 'sale_notification':
                    messageTemplate = whatsappConfig.saleNotificationMessage;
                    if (messageTemplate) {
                        finalMessage = messageTemplate
                            .replace(/{vendedor}/g, msg.data.sellerName || '')
                            .replace(/{produto}/g, msg.data.serviceName || '')
                            .replace(/{plano}/g, msg.data.planName || '')
                            .replace(/{comprador}/g, msg.data.customerName || '')
                            .replace(/{valor}/g, (msg.data.price || 0).toFixed(2));
                    }
                    break;
                
                case 'delivery':
                    messageTemplate = whatsappConfig.deliveryMessage;
                    if (messageTemplate) {
                        finalMessage = messageTemplate
                            .replace(/{cliente}/g, msg.data.customerName || '')
                            .replace(/{produto}/g, msg.data.serviceName || '')
                            .replace(/{plano}/g, msg.data.planName || '')
                            .replace(/{acesso}/g, msg.data.deliverableContent || '');
                    }
                    break;
                
                case 'ticket_notification':
                    messageTemplate = whatsappConfig.ticketNotificationMessage;
                     if (!messageTemplate || messageTemplate.trim() === '') {
                        messageTemplate = 'Olá {cliente}! Você recebeu uma nova mensagem do vendedor {vendedor} sobre sua compra. Acesse o link para responder: {link_ticket}';
                    }
                    finalMessage = messageTemplate
                        .replace(/{cliente}/g, msg.data.customerName || 'Cliente')
                        .replace(/{vendedor}/g, msg.data.sellerName || 'Vendedor')
                        .replace(/{link_ticket}/g, `https://pjcontas.vercel.app/meus-tickets/${msg.data.ticketId || ''}`);
                    break;
            }
            
            if (!finalMessage.trim()) {
                console.warn(`Daemon: Template for message type '${msg.type}' is empty or not configured. Skipping.`);
                // Delete the message from queue to prevent retries for unconfigured templates.
                if (firestore) {
                    const msgRef = doc(firestore, 'pending_whatsapp_messages', msg.id);
                    deleteDocumentNonBlocking(msgRef);
                }
                return;
            }

            const result = await sendWelcomeWhatsAppMessage(msg.recipientPhoneNumber, finalMessage, apiToken);
            
            if (firestore) {
                const msgRef = doc(firestore, 'pending_whatsapp_messages', msg.id);
                deleteDocumentNonBlocking(msgRef);
            }

            if(result?.error) {
                console.error(`Daemon: Failed to send '${msg.type}' message:`, result.error);
                toast({
                    variant: 'destructive',
                    title: `Falha no Envio (${msg.type})`,
                    description: `Não foi possível enviar mensagem para ${msg.recipientPhoneNumber}. Erro: ${result.error}`,
                });
            } else {
                 toast({
                    title: `Mensagem Enviada (${msg.type})`,
                    description: `Mensagem enviada com sucesso para ${msg.recipientPhoneNumber}.`,
                });
            }
        });

    }, [pendingMessages, whatsappConfig, firestore, toast]);

    return null;
}
