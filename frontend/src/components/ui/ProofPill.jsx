import React from 'react';
import Icon from '../AppIcon';
import Button from './Button';

/**
 * ProofPill component for displaying blockchain proof links
 * Shows HashScan links for HCS messages, HTS transactions, and HFS files
 */
const ProofPill = ({ 
  type, 
  id, 
  label, 
  hashscanLink, 
  status = 'confirmed',
  timestamp,
  className = '',
  size = 'default' // 'small', 'default', 'large'
}) => {
  const getTypeIcon = (type) => {
    switch (type) {
      case 'hcs':
      case 'milestone_verification':
        return 'MessageSquare';
      case 'hts':
      case 'funding_disbursement':
        return 'Coins';
      case 'hfs':
      case 'file_upload':
        return 'FileText';
      case 'nft':
      case 'invoice_nft':
        return 'Image';
      default:
        return 'Link';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'text-success bg-success/10 border-success/20';
      case 'pending':
        return 'text-warning bg-warning/10 border-warning/20';
      case 'failed':
        return 'text-destructive bg-destructive/10 border-destructive/20';
      default:
        return 'text-muted-foreground bg-muted/10 border-border';
    }
  };

  const getSizeClasses = (size) => {
    switch (size) {
      case 'small':
        return 'px-2 py-1 text-xs';
      case 'large':
        return 'px-4 py-3 text-base';
      default:
        return 'px-3 py-2 text-sm';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleProofClick = () => {
    if (hashscanLink) {
      window.open(hashscanLink, '_blank', 'noopener,noreferrer');
    }
  };

  const truncateId = (id, length = 8) => {
    if (!id) return '';
    if (id.length <= length) return id;
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  };

  return (
    <div 
      className={`
        inline-flex items-center space-x-2 rounded-lg border transition-all duration-200
        ${getStatusColor(status)}
        ${getSizeClasses(size)}
        ${hashscanLink ? 'cursor-pointer hover:shadow-md hover:scale-105' : ''}
        ${className}
      `}
      onClick={hashscanLink ? handleProofClick : undefined}
      title={hashscanLink ? 'Click to view on HashScan' : undefined}
    >
      {/* Type Icon */}
      <Icon 
        name={getTypeIcon(type)} 
        size={size === 'small' ? 12 : size === 'large' ? 20 : 16} 
        className="flex-shrink-0"
      />
      
      {/* Content */}
      <div className="flex flex-col min-w-0">
        {/* Label and ID */}
        <div className="flex items-center space-x-1">
          {label && (
            <span className="font-medium truncate">
              {label}
            </span>
          )}
          {id && (
            <span className="font-mono text-xs opacity-75">
              {truncateId(id)}
            </span>
          )}
        </div>
        
        {/* Timestamp */}
        {timestamp && size !== 'small' && (
          <span className="text-xs opacity-60">
            {formatTimestamp(timestamp)}
          </span>
        )}
      </div>
      
      {/* External Link Icon */}
      {hashscanLink && (
        <Icon 
          name="ExternalLink" 
          size={size === 'small' ? 10 : size === 'large' ? 16 : 12} 
          className="flex-shrink-0 opacity-60"
        />
      )}
    </div>
  );
};

/**
 * ProofPillGroup component for displaying multiple proof pills
 */
export const ProofPillGroup = ({ 
  proofs = [], 
  title,
  className = '',
  size = 'default',
  maxVisible = 3
}) => {
  const [showAll, setShowAll] = React.useState(false);
  
  const visibleProofs = showAll ? proofs : proofs.slice(0, maxVisible);
  const hasMore = proofs.length > maxVisible;

  return (
    <div className={`space-y-2 ${className}`}>
      {title && (
        <h4 className="text-sm font-medium text-foreground">
          {title}
        </h4>
      )}
      
      <div className="flex flex-wrap gap-2">
        {visibleProofs.map((proof, index) => (
          <ProofPill
            key={proof.id || index}
            type={proof.type}
            id={proof.id}
            label={proof.label}
            hashscanLink={proof.hashscanLink}
            status={proof.status}
            timestamp={proof.timestamp}
            size={size}
          />
        ))}
        
        {hasMore && !showAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(true)}
            className="h-auto px-2 py-1 text-xs"
          >
            +{proofs.length - maxVisible} more
          </Button>
        )}
        
        {showAll && hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(false)}
            className="h-auto px-2 py-1 text-xs"
          >
            Show less
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProofPill;