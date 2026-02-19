
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { PaymentConfig } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const paymentConfigSchema = z.object({
  activeProvider: z.enum(['axenpay', 'pushinpay']),
  axenpay_clientId: z.string().optional(),
  axenpay_clientSecret: z.string().optional(),
  pushinpay_apiKey: z.string().optional(),
}).refine(data => {
    if (data.activeProvider === 'axenpay') {
        return !!data.axenpay_clientId && !!data.axenpay_clientSecret;
    }
    return true;
}, {
    message: "Client ID e Client Secret são obrigatórios para AxenPay.",
    path: ["axenpay_clientId"], 
}).refine(data => {
    if (data.activeProvider === 'pushinpay') {
        return !!data.pushinpay_apiKey;
    }
    return true;
}, {
    message: "API Key é obrigatória para PushinPay.",
    path: ["pushinpay_apiKey"],
});

type PaymentConfigFormData = z.infer<typeof paymentConfigSchema>;

export default function PaymentProviderManagerPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const configDocRef = useMemoFirebase(() => doc(firestore, 'configs', 'payment'), [firestore]);
  const { data: paymentConfig, isLoading: isConfigLoading } = useDoc<PaymentConfig>(configDocRef);

  const form = useForm<PaymentConfigFormData>({
    resolver: zodResolver(paymentConfigSchema),
    defaultValues: {
      activeProvider: 'pushinpay',
      axenpay_clientId: '',
      axenpay_clientSecret: '',
      pushinpay_apiKey: '',
    },
  });

  const { handleSubmit, control, watch, reset, formState } = form;
  const activeProvider = watch('activeProvider');

  useEffect(() => {
    if (paymentConfig) {
      reset({
        activeProvider: paymentConfig.activeProvider || 'pushinpay',
        axenpay_clientId: paymentConfig.axenpay?.clientId || '',
        axenpay_clientSecret: paymentConfig.axenpay?.clientSecret || '',
        pushinpay_apiKey: paymentConfig.pushinpay?.apiKey || '',
      });
    }
  }, [paymentConfig, reset]);

  const handleSave = (values: PaymentConfigFormData) => {
    if (!firestore) return;

    const configData: PaymentConfig = {
      activeProvider: values.activeProvider,
      axenpay: {
        clientId: values.axenpay_clientId || '',
        clientSecret: values.axenpay_clientSecret || '',
      },
      pushinpay: {
        apiKey: values.pushinpay_apiKey || '',
      },
    };

    setDocumentNonBlocking(configDocRef, configData, { merge: true });
    toast({
      title: 'Configurações de Pagamento Salvas!',
      description: `O provedor ativo agora é ${values.activeProvider}.`,
    });
  };

  if (isConfigLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciador de Pagamentos</CardTitle>
        <CardDescription>Escolha e configure o provedor de pagamento PIX para o seu marketplace.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(handleSave)} className="space-y-6">
            <FormField
              control={control}
              name="activeProvider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provedor de PIX Ativo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o provedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pushinpay">PushinPay</SelectItem>
                      <SelectItem value="axenpay">AxenPay</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    O provedor selecionado será usado para todas as transações PIX.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {activeProvider === 'pushinpay' && (
              <Card className="p-4 bg-muted/50">
                <h3 className="font-semibold mb-4">Credenciais PushinPay</h3>
                 <FormField
                  control={control}
                  name="pushinpay_apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PushinPay API Token</FormLabel>
                      <FormControl><Input type="password" placeholder="Seu token da PushinPay" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Card>
            )}

            {activeProvider === 'axenpay' && (
              <Card className="p-4 bg-muted/50 space-y-4">
                <h3 className="font-semibold">Credenciais AxenPay</h3>
                <FormField
                  control={control}
                  name="axenpay_clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AxenPay Client ID</FormLabel>
                      <FormControl><Input placeholder="Seu Client ID da AxenPay" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={control}
                  name="axenpay_clientSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AxenPay Client Secret</FormLabel>
                      <FormControl><Input type="password" placeholder="Sua Client Secret da AxenPay" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Card>
            )}

            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar Configurações
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
