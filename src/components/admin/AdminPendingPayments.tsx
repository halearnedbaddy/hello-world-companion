import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { SUPABASE_URL } from '@/lib/supabaseProject';
import { Check, X, RefreshCw, Clock, AlertTriangle, Eye, Search } from 'lucide-react';

interface PendingTransaction {
  id: string;
  item_name: string;
  amount: number;
  currency: string;
  status: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  seller_id: string;
  seller_name?: string;
  escrow_status: string | null;
  created_at: string;
  updated_at: string;
  deposit?: {
    id: string;
    payer_name: string | null;
    payer_phone: string | null;
    payment_reference: string | null;
    payment_method: string;
    status: string;
    created_at: string;
  };
}

export function AdminPendingPayments() {
  const { formatPrice } = useCurrency();
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTx, setSelectedTx] = useState<PendingTransaction | null>(null);

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const getAuthToken = async () => {
    const { data: session } = await supabase.auth.getSession();
    return session.session?.access_token;
  };

  const fetchPendingPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch transactions with processing status (awaiting payment confirmation)
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .in('status', ['processing'])
        .order('created_at', { ascending: false });

      if (txError) throw txError;

      // Fetch related escrow deposits for these transactions
      const txIds = (txData || []).map(tx => tx.id);
      let deposits: any[] = [];
      if (txIds.length > 0) {
        const { data: depData } = await supabase
          .from('escrow_deposits')
          .select('*')
          .in('transaction_id', txIds);
        deposits = depData || [];
      }

      // Fetch seller profiles for names
      const sellerIds = [...new Set((txData || []).map(tx => tx.seller_id))];
      let sellerProfiles: Record<string, string> = {};
      if (sellerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', sellerIds);
        (profiles || []).forEach((p: any) => {
          sellerProfiles[p.user_id] = p.name;
        });
      }

      // Combine data
      const combined: PendingTransaction[] = (txData || []).map((tx: any) => {
        const deposit = deposits.find((d: any) => d.transaction_id === tx.id);
        return {
          ...tx,
          seller_name: sellerProfiles[tx.seller_id] || 'Unknown Seller',
          deposit: deposit ? {
            id: deposit.id,
            payer_name: deposit.payer_name,
            payer_phone: deposit.payer_phone,
            payment_reference: deposit.payment_reference,
            payment_method: deposit.payment_method,
            status: deposit.status,
            created_at: deposit.created_at,
          } : undefined,
        };
      });

      setTransactions(combined);
    } catch (err) {
      console.error('Failed to fetch pending payments:', err);
      setError('Failed to load pending payments');
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (orderId: string) => {
    setActionLoading(orderId);
    setError(null);
    setSuccessMessage(null);
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/escrow-api/confirm-payment/${orderId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ adminNotes: 'Payment confirmed by admin' }),
        }
      );

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to confirm payment');

      setSuccessMessage(`Payment confirmed for ${orderId}. Funds locked in escrow.`);
      await fetchPendingPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm payment');
    } finally {
      setActionLoading(null);
    }
  };

  const rejectPayment = async (orderId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    setActionLoading(orderId);
    setError(null);
    try {
      // Update transaction back to pending with rejection info
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'pending' as any,
          escrow_status: 'rejected',
          payment_reference: null,
          payment_method: null,
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Update deposit status
      await supabase
        .from('escrow_deposits')
        .update({
          status: 'rejected',
          admin_notes: reason,
        })
        .eq('transaction_id', orderId);

      setSuccessMessage(`Payment for ${orderId} rejected. Buyer will be notified.`);
      await fetchPendingPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject payment');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const filteredTransactions = transactions.filter(tx => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      tx.id.toLowerCase().includes(term) ||
      tx.item_name.toLowerCase().includes(term) ||
      (tx.buyer_name?.toLowerCase().includes(term) ?? false) ||
      (tx.buyer_phone?.includes(term) ?? false) ||
      (tx.payment_reference?.toLowerCase().includes(term) ?? false) ||
      (tx.seller_name?.toLowerCase().includes(term) ?? false)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#3d1a7a]">Pending Payment Confirmations</h2>
          <p className="text-sm text-gray-500 mt-1">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} awaiting payment verification
          </p>
        </div>
        <button
          onClick={fetchPendingPayments}
          className="flex items-center gap-2 px-4 py-2 bg-[#5d2ba3] text-white rounded-lg text-sm font-semibold hover:bg-[#3d1a7a] transition"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <Check size={16} />
          {successMessage}
          <button onClick={() => setSuccessMessage(null)} className="ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search by ID, buyer, seller, reference..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#3d1a7a] text-sm"
        />
      </div>

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p className="font-medium">No pending payment confirmations</p>
          <p className="text-sm mt-2">All payments have been processed</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTransactions.map((tx) => (
            <div key={tx.id} className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
              {/* Card Header */}
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      AWAITING CONFIRMATION
                    </span>
                    <span className="text-sm text-gray-500 font-mono">{tx.id}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 block text-xs">Item</span>
                      <span className="font-semibold text-gray-900">{tx.item_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs">Amount</span>
                      <span className="font-bold text-[#3d1a7a]">
                        {formatPrice(tx.amount, tx.currency || 'KES')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs">Buyer</span>
                      <span className="font-medium text-gray-900">{tx.buyer_name || 'N/A'}</span>
                      <span className="block text-xs text-gray-500">{tx.buyer_phone || ''}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs">Seller</span>
                      <span className="font-medium text-gray-900">{tx.seller_name}</span>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-600 uppercase">Payment Details</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs">Method:</span>
                        <span className="ml-1 font-medium">{tx.payment_method || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Reference:</span>
                        <span className="ml-1 font-mono font-medium text-[#3d1a7a]">
                          {tx.payment_reference || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Submitted:</span>
                        <span className="ml-1">{formatDate(tx.created_at)}</span>
                      </div>
                    </div>
                    {tx.deposit && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm mt-1">
                        <div>
                          <span className="text-gray-500 text-xs">Deposit Ref:</span>
                          <span className="ml-1 font-mono">{tx.deposit.payment_reference || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Payer:</span>
                          <span className="ml-1">{tx.deposit.payer_name || tx.deposit.payer_phone || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Deposit Status:</span>
                          <span className={`ml-1 font-medium ${
                            tx.deposit.status === 'pending' ? 'text-amber-600' : 'text-green-600'
                          }`}>
                            {tx.deposit.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => confirmPayment(tx.id)}
                    disabled={actionLoading === tx.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                  >
                    {actionLoading === tx.id ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Confirm
                  </button>
                  <button
                    onClick={() => rejectPayment(tx.id)}
                    disabled={actionLoading === tx.id}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                  >
                    <X size={14} />
                    Reject
                  </button>
                  <button
                    onClick={() => setSelectedTx(selectedTx?.id === tx.id ? null : tx)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 text-sm font-medium"
                  >
                    <Eye size={14} />
                    Details
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {selectedTx?.id === tx.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 block text-xs">Buyer Email</span>
                      <span>{tx.buyer_email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs">Escrow Status</span>
                      <span className="font-medium">{tx.escrow_status || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs">Created</span>
                      <span>{formatDate(tx.created_at)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs">Last Updated</span>
                      <span>{formatDate(tx.updated_at)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}