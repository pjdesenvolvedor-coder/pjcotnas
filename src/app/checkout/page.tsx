'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Copy, Loader2, QrCode, CheckCircle, Info, Ticket as CouponIcon, Gift } from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { LoginForm } from '@/components/auth/login-form';
import { SignupForm } from '@/components/auth/signup-form';
import {
  useUser,
  useDoc,
  useFirestore,
  useMemoFirebase,
  addDocumentNonBlocking,
  setDocumentNonBlocking,
  updateDocumentNonBlocking,
} from '@/firebase';
import {
  doc,
  collection,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  increment,
} from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import type { Plan, SubscriptionService, Deliverable, UserProfile, Coupon } from '@/lib/types';
import Link from 'next/link';
import Image from 'next/image';
import { generatePixAction, checkPixStatusAction, validateCouponAction } from './actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type PixDetails = {
  id: string;
  qr_code: string;
  qr_code_base64: string;
};

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const serviceId = searchParams.get('serviceId');
  const planId = searchParams.get('planId');

  const [checkoutStep, setCheckoutStep] = useState<'coupon' | 'payment'>('coupon');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [finalPrice, setFinalPrice] = useState<number | null>(null);

  const [pixDetails, setPixDetails] = useState<PixDetails | null>(null);
  const [isGeneratingPix, setIsGeneratingPix] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<string>('pending');
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  const serviceRef = useMemoFirebase(
    () => (firestore && serviceId ? doc(firestore, 'services', serviceId) : null),
    [firestore, serviceId]
  );
  const { data: service, isLoading: isServiceLoading } =
    useDoc<SubscriptionService>(serviceRef);

  const planRef = useMemoFirebase(
    () => (firestore && planId ? doc(firestore, 'subscriptions', planId) : null),
    [firestore, planId]
  );
  const { data: plan, isLoading: isPlanLoading } = useDoc<Plan>(planRef);

  useEffect(() => {
    if (plan) {
      setFinalPrice(plan.price);
    }
  }, [plan]);

  // Set abandonment flag
  useEffect(() => {
    if (planId) {
      sessionStorage.setItem('abandoned_checkout_plan_id', planId);
    }
  }, [planId]);

  const handleApplyCoupon = useCallback(async (codeToApply?: string) => {
    const effectiveCouponCode = (codeToApply || couponCode).trim();
    if (!effectiveCouponCode || !plan || !planId) return;
    
    setIsApplyingCoupon(true);
    setCouponError(null);
    const result = await validateCouponAction(effectiveCouponCode, planId);
    if (result.error) {
        setCouponError(result.error);
        setAppliedCoupon(null);
        setFinalPrice(plan.price);
    } else if (result.data) {
        setAppliedCoupon(result.data);
        const discount = plan.price * (result.data.discountPercentage / 100);
        setFinalPrice(plan.price - discount);
        toast({ title: "Cupom aplicado com sucesso!" });
    }
    setIsApplyingCoupon(false);
  }, [couponCode, plan, planId, toast]);
  
  // Pre-apply coupon from abandoned cart flow
  useEffect(() => {
      const appliedCouponCode = sessionStorage.getItem('applied_coupon_code');
      if (appliedCouponCode && plan && !appliedCoupon) { 
          setCouponCode(appliedCouponCode);
          handleApplyCoupon(appliedCouponCode);
          sessionStorage.removeItem('applied_coupon_code');
      }
  }, [plan, appliedCoupon, handleApplyCoupon]);


  const handleSuccessfulPayment = useCallback(async () => {
    if (isProcessingOrder || !user || !plan || !service || !firestore || finalPrice === null) return;
    
    sessionStorage.removeItem('abandoned_checkout_plan_id');
    setIsProcessingOrder(true);

    try {
      // Increment coupon usage if one was applied
      if (appliedCoupon) {
        const couponRef = doc(firestore, 'coupons', appliedCoupon.id);
        updateDocumentNonBlocking(couponRef, {
          usageCount: increment(1)
        });
      }

      // Fetch seller and customer profiles to get phone numbers
      const sellerProfileRef = doc(firestore, 'users', plan.sellerId);
      const customerProfileRef = doc(firestore, 'users', user.uid);
      
      const [sellerProfileSnap, customerProfileSnap] = await Promise.all([
        getDoc(sellerProfileRef),
        getDoc(customerProfileRef)
      ]);

      const sellerProfile = sellerProfileSnap.data() as UserProfile;
      const customerProfile = customerProfileSnap.data() as UserProfile;
      
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 30);

      const userSubscriptionsRef = collection(firestore, 'users', user.uid, 'userSubscriptions');
      const newSubscriptionData = {
        userId: user.uid,
        subscriptionId: plan.id,
        serviceId: service.id,
        planName: plan.name,
        serviceName: service.name,
        price: finalPrice, // Use final discounted price
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        paymentMethod: finalPrice <= 0 && appliedCoupon ? `Cupom (${appliedCoupon.name})` : 'PIX',
        bannerUrl: plan.bannerUrl,
      };
      const userSubDocRef = await addDocumentNonBlocking(userSubscriptionsRef, newSubscriptionData);

      const ticketsCollection = collection(firestore, 'tickets');
      const newTicketRef = doc(ticketsCollection);
      const newTicketData = {
        id: newTicketRef.id,
        userSubscriptionId: userSubDocRef.id,
        customerId: user.uid,
        customerName: user.displayName || 'Cliente',
        sellerId: plan.sellerId,
        sellerName: plan.sellerName || plan.sellerUsername || 'Vendedor',
        subscriptionId: plan.id,
        serviceName: service.name,
        planName: plan.name,
        price: finalPrice,
        status: 'open' as const,
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        lastMessageText: 'Sua compra foi concluída. O ticket foi aberto para entrega e suporte.',
        unreadBySellerCount: 1,
        unreadByCustomerCount: 0,
      };
      setDocumentNonBlocking(newTicketRef, newTicketData, { merge: false });
      
      updateDocumentNonBlocking(userSubDocRef, { ticketId: newTicketRef.id });

      const deliverableCollectionRef = collection(firestore, 'subscriptions', plan.id, 'deliverables');
      const q = query(deliverableCollectionRef, where('status', '==', 'available'));
      const snapshot = await getDocs(q);
      const chatMessagesCollection = collection(firestore, 'tickets', newTicketRef.id, 'messages');
      const pendingMessagesRef = collection(firestore, 'pending_whatsapp_messages');

      let deliverableContentForMessage: string;

      if (snapshot.empty) {
        const stockOutMessage = {
          ticketId: newTicketRef.id,
          senderId: plan.sellerId,
          senderName: plan.sellerUsername || plan.sellerName || 'Vendedor',
          text: 'Olá! Obrigado pela sua compra. No momento, estou sem estoque para este item, mas vou repor o mais rápido possível. Por favor, aguarde.',
          timestamp: new Date().toISOString(),
          type: 'text' as const,
        };
        addDocumentNonBlocking(chatMessagesCollection, stockOutMessage);
        
        updateDocumentNonBlocking(newTicketRef, {
          lastMessageText: 'ATENÇÃO: Venda realizada sem estoque! Repor e entregar manualmente.',
          unreadBySellerCount: increment(1),
          unreadByCustomerCount: 1,
        });

        deliverableContentForMessage = 'Olá! Obrigado pela sua compra. No momento, estou sem estoque para este item, mas vou repor o mais rápido possível. Por favor, aguarde.';
      } else {
        const sortedDeliverables = snapshot.docs.sort((a, b) => new Date(a.data().createdAt).getTime() - new Date(b.data().createdAt).getTime());
        const deliverableDoc = sortedDeliverables[0];
        const deliverableData = deliverableDoc.data() as Deliverable;
        
        updateDocumentNonBlocking(deliverableDoc.ref, { status: 'sold' });

        const deliveryMessage = {
          ticketId: newTicketRef.id,
          senderId: plan.sellerId,
          senderName: plan.sellerUsername || plan.sellerName || 'Vendedor',
          text: `Obrigado pela sua compra! Aqui estão os detalhes do seu acesso:\n\n\'\'\'${deliverableData.content}\'\'\'`,
          timestamp: new Date().toISOString(),
          type: 'text' as const,
        };
        addDocumentNonBlocking(chatMessagesCollection, deliveryMessage);
        
        updateDocumentNonBlocking(newTicketRef, {
          lastMessageText: 'Produto entregue automaticamente.',
          unreadBySellerCount: 0,
          unreadByCustomerCount: 1,
        });
        deliverableContentForMessage = `Obrigado pela sua compra! Aqui estão os detalhes do seu acesso:\n\n${deliverableData.content}`;
      }

      // Queue Delivery Message for Buyer
      if (customerProfile?.phoneNumber) {
          addDocumentNonBlocking(pendingMessagesRef, {
              type: 'delivery',
              recipientPhoneNumber: customerProfile.phoneNumber,
              createdAt: new Date().toISOString(),
              data: {
                  customerName: customerProfile.firstName,
                  serviceName: service.name,
                  planName: plan.name,
                  deliverableContent: deliverableContentForMessage,
              }
          });
      }

      // Queue Sale Notification for Seller
      if (sellerProfile?.phoneNumber) {
          addDocumentNonBlocking(pendingMessagesRef, {
              type: 'sale_notification',
              recipientPhoneNumber: sellerProfile.phoneNumber,
              createdAt: new Date().toISOString(),
              data: {
                  sellerName: sellerProfile.firstName,
                  customerName: customerProfile.firstName,
                  serviceName: service.name,
                  planName: plan.name,
                  price: finalPrice
              }
          });
      }
      
      toast({
        title: 'Pagamento bem-sucedido!',
        description: `Sua assinatura do ${service.name} está ativa. Um ticket foi aberto.`,
      });
      
      router.push(`/meus-tickets/${newTicketRef.id}`);

    } catch (error) {
      console.error("Checkout process error:", error);
      toast({
        variant: "destructive",
        title: "Uh oh! Algo deu errado.",
        description: "Não foi possível processar sua compra. Tente novamente.",
      });
      setIsProcessingOrder(false);
    }
  }, [user, plan, service, firestore, toast, router, isProcessingOrder, finalPrice, appliedCoupon]);

  useEffect(() => {
    if (checkoutStep === 'payment' && finalPrice !== null && finalPrice > 0 && !pixDetails && isGeneratingPix) {
      const valueInCents = Math.round(finalPrice * 100);
      generatePixAction(valueInCents)
        .then(details => {
          if (details.error) {
            console.error("PIX Generation Error:", details.error);
            toast({
              variant: "destructive",
              title: "Erro ao Gerar PIX",
              description: details.error,
              duration: 10000,
            });
          } else {
            setPixDetails(details as PixDetails);
          }
          setIsGeneratingPix(false);
        })
        .catch(err => {
          console.error("Unexpected PIX Generation Error:", err);
          toast({
            variant: "destructive",
            title: "Erro Inesperado",
            description: "Ocorreu um erro inesperado ao gerar o PIX. Por favor, tente novamente.",
          });
          setIsGeneratingPix(false);
        });
    }
  }, [checkoutStep, finalPrice, pixDetails, isGeneratingPix, toast]);

  useEffect(() => {
    if (paymentStatus === 'paid' && !isProcessingOrder) {
      handleSuccessfulPayment();
    }
  }, [paymentStatus, isProcessingOrder, handleSuccessfulPayment]);

  useEffect(() => {
    if (!pixDetails?.id || paymentStatus === 'paid' || isProcessingOrder) {
      return;
    }

    const intervalId = setInterval(() => {
      checkPixStatusAction(pixDetails.id)
        .then(result => {
          if (result.error) {
            console.error("PIX Status Check Error:", result.error);
          } else if (result.status === 'paid') {
            setPaymentStatus('paid');
          }
        })
        .catch(err => {
          console.error("Unexpected PIX Status Check Error:", err);
        });
    }, 5000);

    return () => clearInterval(intervalId);
  }, [pixDetails, paymentStatus, isProcessingOrder]);

  const handleProceedToPayment = () => {
    if (!plan) return;
    if (finalPrice !== null && finalPrice <= 0) {
      handleSuccessfulPayment();
    } else {
      setCheckoutStep('payment');
    }
  };
  
  const handleContinueWithoutCoupon = () => {
    if (!plan) return;
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
    setFinalPrice(plan.price);
    setCheckoutStep('payment');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Código PIX copiado!" });
  };

  const isLoading = isUserLoading || isServiceLoading || isPlanLoading;

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 gap-8">
        <Card><CardHeader><Skeleton className="h-64 w-full" /></CardHeader></Card>
        <Card><CardHeader><Skeleton className="h-64 w-full" /></CardHeader></Card>
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
            <CardTitle>Acesse sua Conta</CardTitle>
            <CardDescription>Faça login ou cadastre-se para continuar a compra.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Cadastrar</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="pt-4">
              <LoginForm />
            </TabsContent>
            <TabsContent value="register" className="pt-4">
              <SignupForm />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  if (!service || !plan) {
    return (
      <Card>
        <CardHeader><CardTitle>Erro</CardTitle></CardHeader>
        <CardContent><p>Plano de assinatura inválido. Por favor, volte e tente novamente.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <Card className="flex flex-col">
        <CardHeader><CardTitle>Resumo do Pedido</CardTitle></CardHeader>
        <CardContent className="flex-grow space-y-6">
          {plan.bannerUrl && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              <Image src={plan.bannerUrl} alt={plan.name} fill className="object-cover" data-ai-hint={plan.bannerHint || 'subscription service'} />
            </div>
          )}
          <div className="space-y-4">
            <div className="flex justify-between"><span className="text-muted-foreground">Plano:</span><span className="font-semibold">{plan.name}</span></div>
            {appliedCoupon && (
              <>
                <div className="flex justify-between text-muted-foreground"><span >Preço Original:</span><span className="line-through">R$ {plan.price.toFixed(2)}</span></div>
                <div className="flex justify-between text-primary"><span >Desconto ({appliedCoupon.name}):</span><span>- R$ {(plan.price - (finalPrice || 0)).toFixed(2)}</span></div>
              </>
            )}
            <div className="flex justify-between border-t pt-4"><span className="text-lg font-semibold">Total:</span><span className="text-lg font-bold text-primary">R$ {finalPrice !== null ? finalPrice.toFixed(2) : plan.price.toFixed(2)}</span></div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4">
            <Info className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <strong>Pagamento Seguro:</strong> O valor pago só será liberado para o vendedor após 7 dias, de acordo com as políticas de compra.
            </p>
          </div>
        </CardContent>
        <CardFooter><p className="text-xs text-muted-foreground">No dia do vencimento, avisaremos você para renovar.</p></CardFooter>
      </Card>

      <Card>
        {checkoutStep === 'coupon' && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CouponIcon className="h-6 w-6" /> Cupom de Desconto</CardTitle>
              <CardDescription>Possui um cupom? Aplique-o aqui.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="coupon-code">Código do Cupom</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="coupon-code" 
                    placeholder="EX: PROMO10" 
                    value={couponCode} 
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    disabled={isApplyingCoupon || isProcessingOrder}
                  />
                  <Button onClick={() => handleApplyCoupon()} disabled={!couponCode.trim() || isApplyingCoupon || isProcessingOrder}>
                    {isApplyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
                  </Button>
                </div>
              </div>
              {couponError && (
                <Alert variant="destructive">
                    <AlertDescription>{couponError}</AlertDescription>
                </Alert>
              )}
              {appliedCoupon && (
                 <Alert variant="default" className="border-green-500 bg-green-50 text-green-700">
                    <CheckCircle className="h-4 w-4 !text-green-700" />
                    <AlertTitle>Cupom Aplicado!</AlertTitle>
                    <AlertDescription>Você recebeu um desconto de {appliedCoupon.discountPercentage}%.</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex-col gap-4">
               {finalPrice !== null && finalPrice <= 0 ? (
                  <Button onClick={handleProceedToPayment} className="w-full" disabled={isProcessingOrder}>
                      {isProcessingOrder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                      {isProcessingOrder ? 'Resgatando...' : 'Resgatar Gratuitamente'}
                  </Button>
                ) : (
                  <>
                      <Button onClick={handleProceedToPayment} className="w-full" disabled={isProcessingOrder}>
                          {isProcessingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Prosseguir para Pagamento'}
                      </Button>
                      <Button onClick={handleContinueWithoutCoupon} variant="link" className="text-muted-foreground" disabled={isProcessingOrder}>
                          Continuar sem cupom
                      </Button>
                  </>
                )}
            </CardFooter>
          </>
        )}

        {checkoutStep === 'payment' && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><QrCode className="h-6 w-6" /> Pagamento com PIX</CardTitle>
              <CardDescription>Escaneie o QR Code ou copie o código abaixo.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center gap-6">
              {isGeneratingPix && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">Gerando seu PIX...</p>
                </div>
              )}

              {pixDetails && paymentStatus !== 'paid' && (
                <>
                  {pixDetails.qr_code_base64 ? (
                    <div className="p-4 bg-white rounded-lg border">
                      <Image src={pixDetails.qr_code_base64} alt="PIX QR Code" width={256} height={256} unoptimized />
                    </div>
                  ) : (
                    <div className="flex h-[288px] w-[288px] flex-col items-center justify-center rounded-lg border bg-muted/50 p-4 text-center">
                      <QrCode className="h-16 w-16 text-muted-foreground" />
                      <p className="mt-4 text-sm font-medium">QR Code indisponível</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Use a opção "PIX Copia e Cola" abaixo.
                      </p>
                    </div>
                  )}
                  <p className="text-muted-foreground text-sm">Aguardando pagamento...</p>
                  <div className="w-full space-y-2">
                    <Label htmlFor="pix-code">PIX Copia e Cola</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="pix-code"
                        readOnly
                        value={pixDetails.qr_code}
                        className="truncate cursor-pointer"
                        onClick={() => copyToClipboard(pixDetails.qr_code)}
                      />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(pixDetails.qr_code)}><Copy className="h-4 w-4" /></Button>
                    </div>
                    <p className="text-xs text-destructive text-center pt-1">
                      Clique no campo acima para copiar o código.
                    </p>
                  </div>
                </>
              )}

              {paymentStatus === 'paid' && (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold">Pagamento Aprovado!</h3>
                  <p className="text-muted-foreground">Estamos processando seu pedido. Você será redirecionado em breve.</p>
                  <Loader2 className="h-8 w-8 animate-spin text-primary mt-4" />
                </div>
              )}
            </CardContent>
            <CardFooter className="flex-col items-center text-center">
               <Button variant="link" onClick={() => setCheckoutStep('coupon')} className="text-sm">Voltar e alterar cupom</Button>
               <p className="text-xs text-muted-foreground mt-1">Esta cobrança expira em 1 hora.</p>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="container mx-auto max-w-4xl py-12 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={<div>Carregando...</div>}>
        <CheckoutForm />
      </Suspense>
    </div>
  );
}
