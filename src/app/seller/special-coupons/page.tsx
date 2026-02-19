
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useDoc, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { Coupon, SpecialCouponsConfig } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const specialCouponsSchema = z.object({
  abandonedCartCouponId: z.string().optional(),
});

type SpecialCouponsFormData = z.infer<typeof specialCouponsSchema>;

export default function SpecialCouponsManagerPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const configDocRef = useMemoFirebase(() => doc(firestore, 'configs', 'special_coupons'), [firestore]);
  const { data: specialCouponsConfig, isLoading: isConfigLoading } = useDoc<SpecialCouponsConfig>(configDocRef);
  
  const couponsQuery = useMemoFirebase(() => collection(firestore, 'coupons'), [firestore]);
  const { data: allCoupons, isLoading: areCouponsLoading } = useCollection<Coupon>(couponsQuery);

  const form = useForm<SpecialCouponsFormData>({
    resolver: zodResolver(specialCouponsSchema),
    defaultValues: {
      abandonedCartCouponId: 'none',
    },
  });

  const { handleSubmit, control, reset, formState } = form;

  useEffect(() => {
    if (specialCouponsConfig) {
      reset({
        abandonedCartCouponId: specialCouponsConfig.abandonedCartCouponId || 'none',
      });
    }
  }, [specialCouponsConfig, reset]);

  const handleSave = (values: SpecialCouponsFormData) => {
    if (!firestore) return;

    const configToSave = {
      abandonedCartCouponId: values.abandonedCartCouponId === 'none' ? '' : values.abandonedCartCouponId
    }

    setDocumentNonBlocking(configDocRef, configToSave, { merge: true });
    toast({
      title: 'Configurações Salvas!',
      description: 'O cupom de abandono de carrinho foi definido.',
    });
  };

  const isLoading = isConfigLoading || areCouponsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cupom de Abandono de Carrinho</CardTitle>
        <CardDescription>
          Selecione o cupom que será oferecido a usuários que abandonarem o checkout. 
          O cupom deve ser criado na aba 'Cupons' primeiro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {allCoupons && allCoupons.length > 0 ? (
          <Form {...form}>
            <form onSubmit={handleSubmit(handleSave)} className="space-y-6">
              <FormField
                control={control}
                name="abandonedCartCouponId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cupom a ser Oferecido</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cupom..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                         <SelectItem value="none">Nenhum (desativado)</SelectItem>
                         {allCoupons.map((coupon) => (
                           <SelectItem key={coupon.id} value={coupon.id}>
                             {coupon.name} ({coupon.discountPercentage}%)
                           </SelectItem>
                         ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Este cupom aparecerá para o usuário se ele voltar à página do produto após iniciar o checkout.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={formState.isSubmitting}>
                {formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Configuração
              </Button>
            </form>
          </Form>
        ) : (
            <div className="text-center py-8">
                <p className="text-muted-foreground">Nenhum cupom encontrado.</p>
                <Button variant="link" asChild><Link href="/seller/coupons">Crie um cupom primeiro</Link></Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
