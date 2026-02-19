
'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { WhatsappConfig } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, CheckCircle, XCircle, QrCode as QrCodeIcon, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { connectWhatsApp, checkWhatsAppStatus, disconnectWhatsApp } from '../actions';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'checking' | 'error' | 'qrcode';

export default function WhatsAppManagerPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const configDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'configs', 'whatsapp') : null, [firestore]);
  const { data: whatsappConfig, isLoading: isConfigLoading } = useDoc<WhatsappConfig>(configDocRef);

  const [token, setToken] = useState('');
  const [savedToken, setSavedToken] = useState('');
  
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved token from config doc
  useEffect(() => {
    if (whatsappConfig?.apiToken) {
      setToken(whatsappConfig.apiToken);
      setSavedToken(whatsappConfig.apiToken);
    }
  }, [whatsappConfig]);

  // Initial status check on component load or when savedToken changes
  const performInitialStatusCheck = useCallback(async () => {
    if (savedToken) {
      setStatus('checking');
      setError(null);
      const result = await checkWhatsAppStatus(savedToken);
      if (result.status === 'connected') {
        setStatus('connected');
        setProfileName(result.profileName || null);
        setProfilePicUrl(result.profilePicUrl || null);
      } else {
        setStatus('disconnected');
      }
      if(result.error) {
          setError(result.error);
      }
    } else {
        setStatus('disconnected');
    }
  }, [savedToken]);

  useEffect(() => {
    performInitialStatusCheck();
  }, [performInitialStatusCheck]);


  // Polling logic when QR code is displayed
  useEffect(() => {
    if (status !== 'qrcode' || !savedToken) return;

    const intervalId = setInterval(async () => {
      const result = await checkWhatsAppStatus(savedToken);
      
      if (result.status === 'connected') {
        setStatus('connected');
        setProfileName(result.profileName || null);
        setProfilePicUrl(result.profilePicUrl || null);
        setQrCode(null);
        toast({ title: "WhatsApp Conectado!", description: "Sua conta foi conectada com sucesso." });
      } else if (result.error && status === 'qrcode') { // Only log error if we are still in QR code mode
        console.warn('Falha na verificação de status (nova tentativa em breve):', result.error);
        // Don't set a visible error, just keep polling
      }
    }, 3000);

    const timeoutId = setTimeout(() => {
        if (status === 'qrcode') {
            clearInterval(intervalId);
            setStatus('disconnected');
            setError("Tempo esgotado. Por favor, tente gerar um novo QR Code.");
            setQrCode(null);
        }
    }, 60000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [status, savedToken, toast]);


  const handleSaveToken = () => {
    if (!firestore) return;
    const configRef = doc(firestore, 'configs', 'whatsapp');
    setDocumentNonBlocking(configRef, { apiToken: token }, { merge: true });
    setSavedToken(token);
    toast({
      title: "Token Salvo!",
      description: "Seu token da API do WhatsApp foi atualizado.",
    });
  };
  
  const handleConnect = async () => {
    if (!savedToken) {
        toast({ variant: 'destructive', title: "Token não encontrado", description: "Por favor, salve seu token primeiro."});
        return;
    }
    setIsConnecting(true);
    setQrCode(null);
    setError(null);
    setStatus('connecting');
    
    const result = await connectWhatsApp(savedToken);

    setIsConnecting(false);

    if (result.error || !result.qrCode) {
        setError(result.error || "A resposta da API não continha um QR code.");
        setStatus('error');
        return;
    }

    setQrCode(result.qrCode);
    setStatus('qrcode');
  };

  const handleDisconnect = async () => {
    if (!savedToken) {
        toast({ variant: 'destructive', title: "Token não encontrado", description: "Não foi possível encontrar o token para desconectar."});
        return;
    }
    setIsDisconnecting(true);
    setError(null);
    
    const result = await disconnectWhatsApp(savedToken);
    
    setIsDisconnecting(false);

    if (result.success) {
        setStatus('disconnected');
        setProfileName(null);
        setProfilePicUrl(null);
        toast({ title: "WhatsApp Desconectado", description: "Sua conta foi desconectada com sucesso." });
    } else {
        setError(result.error || "Ocorreu um erro ao desconectar.");
        toast({ variant: 'destructive', title: "Erro ao Desconectar", description: result.error || "Não foi possível desconectar. Tente novamente." });
    }
  };


  const renderStatusContent = () => {
    switch (status) {
      case 'checking':
        return (
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h3 className="font-semibold text-lg">Verificando status...</h3>
          </div>
        );
      case 'connected':
        return (
          <div className="text-center space-y-4 flex flex-col items-center">
            <Avatar className="h-24 w-24 border-4 border-green-500">
                <AvatarImage src={profilePicUrl || undefined} alt={profileName || 'Foto do Perfil'} />
                <AvatarFallback className="text-3xl">{profileName?.charAt(0) || 'W'}</AvatarFallback>
            </Avatar>
            <h3 className="font-bold text-2xl">{profileName || 'Usuário'}</h3>
            <Badge className="bg-green-100 text-green-700 border-green-300">
              <CheckCircle className="mr-2 h-4 w-4" />
              Conectado
            </Badge>
            <Button onClick={handleDisconnect} variant="destructive" className="mt-4">
                {isDisconnecting ? <Loader2 className="animate-spin" /> : <LogOut className="mr-2" />}
                Desconectar
            </Button>
          </div>
        );
      case 'qrcode':
         return (
              <div className="text-center space-y-4">
                  <h3 className="font-semibold text-lg">Escaneie o QR Code</h3>
                  <p className="text-muted-foreground text-sm">Abra o WhatsApp no seu celular e escaneie a imagem abaixo.</p>
                  <div className="bg-white p-4 inline-block rounded-lg border">
                    {qrCode && <Image src={qrCode} alt="WhatsApp QR Code" width={256} height={256} unoptimized />}
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Loader2 className="h-4 w-4 animate-spin"/>
                    <p className="text-sm text-muted-foreground">Aguardando conexão...</p>
                  </div>
              </div>
          );
       case 'connecting':
          return (
              <div className="text-center space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                  <h3 className="font-semibold text-lg">Gerando QR Code...</h3>
                  <p className="text-sm text-muted-foreground">Aguarde um momento.</p>
              </div>
          );
      case 'error':
        return (
            <div className="text-center space-y-4 text-destructive p-4 flex flex-col items-center">
                <XCircle className="h-12 w-12"/>
                <h3 className="font-semibold">Ocorreu um erro</h3>
                <p className="text-sm max-w-xs">{error}</p>
                 <Button onClick={handleConnect} variant="outline" className="mt-4">
                    Tentar Novamente
                </Button>
            </div>
        );
      case 'disconnected':
      default:
        return (
            <div className="text-center space-y-4 flex flex-col items-center">
                <div className="mx-auto bg-gray-100 rounded-full h-24 w-24 flex items-center justify-center">
                    <QrCodeIcon className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="font-semibold text-lg">Pronto para conectar</h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                    {error ? <span className="text-destructive">{error}</span> : 'Salve seu token e clique em "Conectar ao WhatsApp" para gerar o QR Code.'}
                </p>
            </div>
        );
    }
  };


  if (isConfigLoading) {
    return (
        <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-1">
                <CardHeader>
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-24 mt-4" />
                </CardContent>
            </Card>
            <Card className="md:col-span-2">
                 <CardContent className="pt-6 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                 </CardContent>
            </Card>
        </div>
    )
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle>Conexão WhatsApp</CardTitle>
          <CardDescription>
            Conecte sua conta para automatizar mensagens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wa-token">Seu Token da API</Label>
            <Input
              id="wa-token"
              type="password"
              placeholder="Cole seu token aqui"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isConfigLoading}
            />
          </div>
          <Button onClick={handleSaveToken} disabled={isConfigLoading || !token || token === savedToken}>
            Salvar Token
          </Button>
          <div className="border-t pt-4">
              <Button onClick={handleConnect} disabled={!savedToken || isConnecting || status === 'connected' || status === 'qrcode'} className="w-full">
                {isConnecting ? <Loader2 className="animate-spin" /> : (status === 'connected' ? 'Reconectar' : 'Conectar ao WhatsApp')}
              </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="md:col-span-2 flex items-center justify-center min-h-[300px]">
        <CardContent className="pt-6">
          {renderStatusContent()}
        </CardContent>
      </Card>
    </div>
  );
}
