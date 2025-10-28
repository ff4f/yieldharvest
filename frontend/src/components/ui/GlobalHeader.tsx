import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import { Button } from './button';

type UserRole = 'supplier' | 'investor' | 'agent';

interface GlobalHeaderProps {
  userRole?: UserRole;
  userName?: string;
  onLogout?: () => void;
}

const GlobalHeader = ({ userRole = 'supplier', userName = 'John Doe', onLogout }: GlobalHeaderProps) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const location = useLocation();

  const getRoleDisplayName = (role: UserRole): string => {
    const roleMap: Record<UserRole, string> = {
      supplier: 'Supplier Portal',
      investor: 'Investor Portal',
      agent: 'Agent Portal'
    };
    return roleMap[role] || roleMap.supplier;
  };

  const getRoleBadgeColor = (role: UserRole): string => {
    const colorMap: Record<UserRole, string> = {
      supplier: 'bg-blue-100 text-blue-800',
      investor: 'bg-green-100 text-green-800',
      agent: 'bg-purple-100 text-purple-800'
    };
    return colorMap[role] || 'bg-gray-100 text-gray-800';
  };

  const handleLogout = () => {
    // Call the onLogout prop if provided, otherwise implement default logout logic
    if (onLogout) {
      onLogout();
    } else {
      console.log('Logout clicked');
      // Default logout implementation could go here
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Logo Section */}
        <div className="flex items-center">
          <Link to="/" className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
              <Icon name="TrendingUp" size={24} color="white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-foreground">YieldHarvest</span>
              <span className="text-xs text-muted-foreground">DeFi Supply Chain Finance</span>
            </div>
          </Link>
        </div>

        {/* Navigation Links - Desktop */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link
            to="/supplier-portal-dashboard"
            className={`text-sm font-medium transition-institutional hover:text-primary ${
              location?.pathname?.includes('supplier') ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            Supplier Portal
          </Link>
          <Link
            to="/investor-portal-dashboard"
            className={`text-sm font-medium transition-institutional hover:text-primary ${
              location?.pathname?.includes('investor') ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            Investor Portal
          </Link>
          <Link
            to="/agent-portal-milestone-tracking"
            className={`text-sm font-medium transition-institutional hover:text-primary ${
              location?.pathname?.includes('agent') ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            Agent Portal
          </Link>
          <Link
            to="/settlement-audit-dashboard"
            className={`text-sm font-medium transition-institutional hover:text-primary ${
              location?.pathname?.includes('settlement') ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            Audit & Settlement
          </Link>
        </nav>

        {/* User Section */}
        <div className="flex items-center space-x-4">
          {/* Role Badge */}
          <div className={`hidden sm:flex items-center px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(userRole)}`}>
            {getRoleDisplayName(userRole)}
          </div>

          {/* User Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2"
            >
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                <Icon name="User" size={16} />
              </div>
              <span className="hidden sm:block text-sm font-medium">{userName}</span>
              <Icon name="ChevronDown" size={16} />
            </Button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-lg shadow-institutional z-60">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-medium text-foreground">{userName}</p>
                  <p className="text-xs text-muted-foreground">{getRoleDisplayName(userRole)}</p>
                </div>
                <div className="py-2">
                  <button
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-institutional"
                  >
                    <Icon name="User" size={16} className="mr-3" />
                    Profile Settings
                  </button>
                  <button
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-institutional"
                  >
                    <Icon name="Bell" size={16} className="mr-3" />
                    Notifications
                  </button>
                  <button
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-institutional"
                  >
                    <Icon name="HelpCircle" size={16} className="mr-3" />
                    Help & Support
                  </button>
                  <div className="border-t border-border mt-2 pt-2">
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-3 py-2 text-sm text-error hover:bg-muted transition-institutional"
                    >
                      <Icon name="LogOut" size={16} className="mr-3" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => {/* Mobile menu toggle logic */}}
          >
            <Icon name="Menu" size={20} />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default GlobalHeader;