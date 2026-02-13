import { useState } from 'react';
import { StoreSidebar, StoreTab } from './StoreSidebar';
import { StoreOverview } from './StoreOverview';
import { StoreAnalytics } from './StoreAnalytics';
import { StoreProducts } from './StoreProducts';
import { StoreOrders } from './StoreOrders';

import { StoreSettings } from './StoreSettings';
import { Menu, X, Bell, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StoreData {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  bio?: string | null;
  visibility?: string;
  status?: string;
}

interface StoreDashboardProps {
  store: StoreData;
  onStoreUpdate: (data: Partial<StoreData>) => void;
  onBack: () => void;
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <span className="text-2xl">🚧</span>
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        This section is coming soon. We're working hard to bring you this feature.
      </p>
    </div>
  );
}

export function StoreDashboard({ store, onStoreUpdate, onBack }: StoreDashboardProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<StoreTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <StoreOverview storeName={store.name} storeSlug={store.slug} storeId={store.id} onNavigate={(tab) => setActiveTab(tab as StoreTab)} />;
      case 'orders':
        return <StoreOrders />;
      case 'products':
      case 'products-all':
        return <StoreProducts storeSlug={store.slug} />;
      case 'products-categories':
        return <PlaceholderTab title="Categories" />;
      case 'products-bulk':
        return <PlaceholderTab title="Bulk Operations" />;
      case 'products-recommendations':
        return <PlaceholderTab title="Recommendations Engine" />;
      case 'inventory':
      case 'inventory-stock':
        return <PlaceholderTab title="Stock Management" />;
      case 'inventory-locations':
        return <PlaceholderTab title="Locations" />;
      case 'inventory-reorder':
        return <PlaceholderTab title="Reorder Management" />;
      case 'customers':
      case 'customers-all':
        return <PlaceholderTab title="All Customers" />;
      case 'customers-segments':
        return <PlaceholderTab title="Customer Segments" />;
      case 'marketing':
      case 'marketing-email':
        return <PlaceholderTab title="Email Campaigns" />;
      case 'marketing-sms':
        return <PlaceholderTab title="SMS Marketing" />;
      case 'marketing-cart-recovery':
        return <PlaceholderTab title="Cart Recovery" />;
      case 'marketing-loyalty':
        return <PlaceholderTab title="Loyalty Program" />;
      case 'marketing-discounts':
        return <PlaceholderTab title="Discounts & Promotions" />;
      case 'marketing-social':
        return <PlaceholderTab title="Social Media" />;
      case 'analytics':
      case 'analytics-overview':
        return <StoreAnalytics />;
      case 'analytics-forecasting':
        return <PlaceholderTab title="Forecasting" />;
      case 'analytics-customer-insights':
        return <PlaceholderTab title="Customer Insights" />;
      case 'analytics-market-intelligence':
        return <PlaceholderTab title="Market Intelligence" />;
      case 'analytics-custom-reports':
        return <PlaceholderTab title="Custom Reports" />;
      case 'financial':
      case 'financial-accounting':
        return <PlaceholderTab title="Accounting" />;
      case 'financial-tax':
        return <PlaceholderTab title="Tax Settings" />;
      case 'financial-payment-options':
        return <PlaceholderTab title="Payment Options" />;
      case 'financial-health':
        return <PlaceholderTab title="Financial Health" />;
      case 'live-chat':
        return <PlaceholderTab title="Live Chat" />;
      case 'reviews':
        return <PlaceholderTab title="Reviews" />;
      case 'store-settings':
      case 'store-settings-general':
        return <StoreSettings store={store} onUpdate={onStoreUpdate} />;
      case 'store-settings-domain':
        return <PlaceholderTab title="Domain Settings" />;
      case 'store-settings-languages':
        return <PlaceholderTab title="Languages" />;
      case 'store-settings-invoices':
        return <PlaceholderTab title="Invoice Templates" />;
      case 'support':
      case 'support-help':
        return <PlaceholderTab title="Help Center" />;
      case 'support-tickets':
        return <PlaceholderTab title="Support Tickets" />;
      case 'support-account-manager':
        return <PlaceholderTab title="Account Manager" />;
      default:
        return <StoreOverview storeName={store.name} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <nav className="bg-card border-b border-border sticky top-0 z-40">
        <div className="px-4 md:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="md:hidden text-foreground p-2 hover:bg-muted rounded transition"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft size={20} />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </button>
            <div className="hidden md:block w-px h-6 bg-border" />
            <div
              className="text-xl font-black bg-gradient-to-r from-[#5d2ba3] to-[#3d1a7a] bg-clip-text text-transparent cursor-pointer"
              onClick={() => navigate('/')}
            >
              PayLoom
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-foreground hover:bg-muted rounded-full transition">
              <Bell size={24} />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold flex items-center justify-center">
              {store.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:sticky top-16 h-[calc(100vh-64px)] z-30 transition-transform duration-300`}>
          <StoreSidebar 
            activeTab={activeTab} 
            onTabChange={(tab) => {
              setActiveTab(tab);
              setSidebarOpen(false);
            }}
            storeName={store.name}
          />
        </div>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 p-4 md:p-6 min-h-[calc(100vh-64px)]">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
