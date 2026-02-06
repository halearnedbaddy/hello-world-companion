import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { LoaderIcon, ShieldIcon, CheckCircleIcon, ChevronRightIcon, XIcon } from '@/components/icons';
import { Smartphone, Building2, Copy, Check } from 'lucide-react';
import { SUPABASE_URL } from '@/lib/supabaseProject';

interface PaymentLinkData {
  id: string;
  productName: string;
  productDescription?: string;
  price: number;
  originalPrice?: number;
  currency: string;
  images: string[];
  status: string;
  seller: {
    name: string;
    sellerProfile?: {
      rating: number;
      totalReviews: number;
      isVerified: boolean;
    };
  };
}

interface PaymentInfo {
  tillNumber: string;
  businessName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export function BuyPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { formatPrice } = useCurrency();
  const [link, setLink] = useState<PaymentLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'details' | 'payment' | 'success'>('details');
  const [activeImage, setActiveImage] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'MPESA' | 'BANK'>('MPESA');
  const [copied, setCopied] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  
  const [buyerInfo, setBuyerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  const [paymentDetails, setPaymentDetails] = useState({
    reference: '',
  });

  const paymentInfo: PaymentInfo = {
    tillNumber: '4107197',
    businessName: 'PayLoom',
    bankName: 'Equity Bank',
    accountName: 'PayLoom Ltd',
    accountNumber: '1234567890',
  };

  useEffect(() => {
    if (linkId) {
      loadPaymentLink();
    }
  }, [linkId]);

  const loadPaymentLink = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/links-api/${linkId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success && result.data) {
        setLink(result.data);
      } else {
        setError(result.error || 'Payment link not found');
      }
    } catch (err) {
      console.error('Failed to load payment link:', err);
      setError('Failed to load payment link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCreateOrder = async () => {
    if (!buyerInfo.name || !buyerInfo.phone) {
      toast({
        title: 'Required Fields',
        description: 'Please enter your name and phone number',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/links-api/${linkId}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buyerName: buyerInfo.name,
          buyerPhone: buyerInfo.phone,
          buyerEmail: buyerInfo.email || undefined,
          deliveryAddress: buyerInfo.address,
          paymentMethod,
        }),
      });

      const result = await response.json();

      if (result.success && result.data?.transactionId) {
        setTransactionId(result.data.transactionId);
        setCheckoutStep('payment');
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create order',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to process checkout',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!paymentDetails.reference) {
      toast({
        title: 'Required',
        description: 'Please enter your payment reference code',
        variant: 'destructive',
      });
      return;
    }

    if (!transactionId) return;

    setProcessing(true);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/escrow-api/submit-payment/${transactionId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethod,
            paymentReference: paymentDetails.reference,
            payerPhone: buyerInfo.phone,
            payerName: buyerInfo.name,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setCheckoutStep('success');
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to submit payment',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to submit payment',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoaderIcon size={48} className="animate-spin text-[#5d2ba3] mx-auto mb-4" />
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XIcon size={32} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Link Not Available</h1>
          <p className="text-gray-600 mb-6">{error || 'This payment link is invalid or has expired.'}</p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-[#3d1a7a] text-white rounded-lg hover:bg-[#250e52] transition font-medium"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const discount = link.originalPrice ? Math.round(((link.originalPrice - link.price) / link.originalPrice) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.jpeg" alt="PayLoom" className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-2 text-sm text-[#5d2ba3]">
            <ShieldIcon size={16} />
            <span>Secure Checkout</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden">
              {link.images && link.images.length > 0 ? (
                <img
                  src={link.images[activeImage]}
                  alt={link.productName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                  No image available
                </div>
              )}
            </div>
            
            {/* Thumbnails */}
            {link.images && link.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {link.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                      activeImage === idx ? 'border-[#5d2ba3]' : 'border-gray-200'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Seller Info */}
            <div className="flex items-center gap-3 text-sm">
              <div className="w-10 h-10 bg-[#5d2ba3]/20 rounded-full flex items-center justify-center text-[#5d2ba3] font-bold">
                {link.seller.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-900">{link.seller.name}</p>
                {link.seller.sellerProfile?.isVerified && (
                  <span className="inline-flex items-center gap-1 text-xs text-[#5d2ba3]">
                    <CheckCircleIcon size={12} /> Verified Seller
                  </span>
                )}
              </div>
            </div>

            {/* Product Name & Price */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{link.productName}</h1>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-[#3d1a7a]">
                  {formatPrice(link.price, link.currency)}
                </span>
                {link.originalPrice && link.originalPrice > link.price && (
                  <>
                    <span className="text-lg text-gray-400 line-through">
                      {formatPrice(link.originalPrice, link.currency)}
                    </span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-sm font-medium rounded">
                      {discount}% OFF
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            {link.productDescription && (
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600">{link.productDescription}</p>
              </div>
            )}

            {/* Security Features */}
            <div className="bg-[#5d2ba3]/5 border border-[#5d2ba3]/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircleIcon size={16} className="text-[#5d2ba3]" />
                <span>PayLoom Protection - Payment held in escrow</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircleIcon size={16} className="text-[#5d2ba3]" />
                <span>Money-back guarantee if item not received</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircleIcon size={16} className="text-[#5d2ba3]" />
                <span>Secure M-Pesa & Bank Transfer payments</span>
              </div>
            </div>

            {/* Buy Button */}
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full py-4 bg-[#3d1a7a] text-white rounded-lg font-bold text-lg hover:bg-[#250e52] transition flex items-center justify-center gap-2"
            >
              Buy Now
              <ChevronRightIcon size={20} />
            </button>
          </div>
        </div>
      </main>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCheckout(false)} />
          
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#3d1a7a]">
                {checkoutStep === 'details' && 'Complete Your Purchase'}
                {checkoutStep === 'payment' && 'Make Payment'}
                {checkoutStep === 'success' && 'Payment Submitted'}
              </h2>
              <button onClick={() => { setShowCheckout(false); setCheckoutStep('details'); }} className="p-2 hover:bg-gray-100 rounded-full">
                <XIcon size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Order Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex gap-4">
                  {link.images?.[0] && (
                    <img src={link.images[0]} alt="" className="w-16 h-16 object-cover rounded-lg" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{link.productName}</p>
                    <p className="text-lg font-bold text-[#3d1a7a]">
                      {formatPrice(link.price, link.currency)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 1: Buyer Details */}
              {checkoutStep === 'details' && (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                      <input
                        type="text"
                        value={buyerInfo.name}
                        onChange={(e) => setBuyerInfo({ ...buyerInfo, name: e.target.value })}
                        placeholder="Enter your full name"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3d1a7a]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        value={buyerInfo.phone}
                        onChange={(e) => setBuyerInfo({ ...buyerInfo, phone: e.target.value })}
                        placeholder="+254 712 345 678"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3d1a7a]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
                      <input
                        type="email"
                        value={buyerInfo.email}
                        onChange={(e) => setBuyerInfo({ ...buyerInfo, email: e.target.value })}
                        placeholder="your@email.com"
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3d1a7a]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
                      <textarea
                        value={buyerInfo.address}
                        onChange={(e) => setBuyerInfo({ ...buyerInfo, address: e.target.value })}
                        placeholder="Enter delivery address"
                        rows={2}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3d1a7a] resize-none"
                      />
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('MPESA')}
                          className={`p-3 border-2 rounded-lg flex items-center gap-2 transition ${
                            paymentMethod === 'MPESA' 
                              ? 'border-[#3d1a7a] bg-[#3d1a7a]/10' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Smartphone className="text-[#3d1a7a]" size={20} />
                          <span className="font-medium">M-Pesa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('BANK')}
                          className={`p-3 border-2 rounded-lg flex items-center gap-2 transition ${
                            paymentMethod === 'BANK' 
                              ? 'border-[#3d1a7a] bg-[#3d1a7a]/10' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Building2 className="text-[#3d1a7a]" size={20} />
                          <span className="font-medium">Bank</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleCreateOrder}
                    disabled={processing || !buyerInfo.name || !buyerInfo.phone}
                    className="w-full py-4 bg-[#3d1a7a] text-white rounded-lg font-bold hover:bg-[#250e52] disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {processing ? (
                      <>
                        <LoaderIcon size={20} className="animate-spin" />
                        Creating Order...
                      </>
                    ) : (
                      <>
                        Continue to Payment
                        <ChevronRightIcon size={20} />
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Step 2: Payment Instructions */}
              {checkoutStep === 'payment' && (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h3 className="font-semibold text-amber-800 mb-2">
                      💰 Pay {formatPrice(link.price, link.currency)}
                    </h3>
                    <p className="text-sm text-amber-700">
                      Send the exact amount using {paymentMethod === 'MPESA' ? 'M-Pesa' : 'Bank Transfer'}, then enter your confirmation code.
                    </p>
                  </div>

                  {paymentMethod === 'MPESA' ? (
                    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Till Number</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{paymentInfo.tillNumber}</span>
                          <button 
                            onClick={() => copyToClipboard(paymentInfo.tillNumber, 'till')}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {copied === 'till' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Business Name</span>
                        <span className="font-medium">{paymentInfo.businessName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Amount</span>
                        <span className="font-bold text-[#3d1a7a]">{formatPrice(link.price, link.currency)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Bank</span>
                        <span className="font-medium">{paymentInfo.bankName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Account Name</span>
                        <span className="font-medium">{paymentInfo.accountName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Account Number</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{paymentInfo.accountNumber}</span>
                          <button 
                            onClick={() => copyToClipboard(paymentInfo.accountNumber, 'account')}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {copied === 'account' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Amount</span>
                        <span className="font-bold text-[#3d1a7a]">{formatPrice(link.price, link.currency)}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {paymentMethod === 'MPESA' ? 'M-Pesa Confirmation Code *' : 'Bank Reference *'}
                    </label>
                    <input
                      type="text"
                      value={paymentDetails.reference}
                      onChange={(e) => setPaymentDetails({ ...paymentDetails, reference: e.target.value.toUpperCase() })}
                      placeholder={paymentMethod === 'MPESA' ? 'e.g. QHK7XXXXXX' : 'e.g. TXN123456789'}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3d1a7a] uppercase"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setCheckoutStep('details')}
                      className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSubmitPayment}
                      disabled={processing || !paymentDetails.reference}
                      className="flex-1 py-3 bg-[#3d1a7a] text-white rounded-lg font-bold hover:bg-[#250e52] disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                      {processing ? (
                        <LoaderIcon size={20} className="animate-spin" />
                      ) : (
                        'I Have Paid'
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Success */}
              {checkoutStep === 'success' && (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <Check className="text-green-600" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Payment Submitted!</h3>
                  <p className="text-gray-600">
                    Your payment is being verified. You'll receive a notification once it's confirmed.
                  </p>
                  {transactionId && (
                    <div className="bg-gray-100 rounded-lg p-4 text-sm">
                      <p className="text-gray-500">Order ID</p>
                      <p className="font-mono font-bold text-gray-900">{transactionId}</p>
                    </div>
                  )}
                  <button
                    onClick={() => { setShowCheckout(false); setCheckoutStep('details'); navigate(`/track/${transactionId}`); }}
                    className="w-full py-3 bg-[#3d1a7a] text-white rounded-lg font-semibold hover:bg-[#250e52] transition"
                  >
                    Track Order
                  </button>
                </div>
              )}

              {checkoutStep === 'details' && (
                <p className="text-xs text-center text-gray-500">
                  By proceeding, you agree to our Terms of Service and Privacy Policy
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BuyPage;
