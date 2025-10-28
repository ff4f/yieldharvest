import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Badge } from './badge';
import { ExternalLink, Clock, CheckCircle, AlertCircle, Shield, Database } from 'lucide-react';

interface ProofCardProps {
  title: string;
  description: string;
  hashScanLink: string;
  mirrorNodeLink?: string;
  transactionId: string;
  timestamp: string;
  status?: 'confirmed' | 'pending' | 'failed';
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed': return 'bg-success text-success-foreground';
    case 'pending': return 'bg-warning text-warning-foreground';
    case 'failed': return 'bg-destructive text-destructive-foreground';
    default: return 'bg-secondary text-secondary-foreground';
  }
};

const getStatusIcon = (type: string) => {
  switch (type) {
    case 'confirmed': return CheckCircle;
    case 'pending': return Clock;
    case 'failed': return AlertCircle;
    default: return Clock;
  }
};

const ProofCard = ({ 
  title, 
  description, 
  hashScanLink, 
  mirrorNodeLink, 
  transactionId,
  timestamp,
  status = 'confirmed'
}: ProofCardProps) => {
  const StatusIcon = getStatusIcon(status);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <StatusIcon className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Badge variant="secondary" className={getStatusColor(status)}>
            {status.toUpperCase()}
          </Badge>
        </div>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {transactionId && (
          <div>
            <span className="text-xs text-muted-foreground">Transaction ID:</span>
            <p className="text-sm font-mono break-all">{transactionId}</p>
          </div>
        )}

        {timestamp && (
          <div>
            <span className="text-xs text-muted-foreground">Timestamp:</span>
            <p className="text-sm">
              {new Date(timestamp).toLocaleString()}
            </p>
          </div>
        )}

        <div className="flex flex-col space-y-2">
          {hashScanLink && (
            <a
              href={hashScanLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 bg-primary/5 rounded-md hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">View on HashScan</span>
              </div>
              <ExternalLink className="w-4 h-4 text-primary" />
            </a>
          )}

          {mirrorNodeLink && (
            <a
              href={mirrorNodeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 bg-secondary/50 rounded-md hover:bg-secondary/70 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-secondary-foreground" />
                <span className="text-sm font-medium">View on Mirror Node</span>
              </div>
              <ExternalLink className="w-4 h-4 text-secondary-foreground" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProofCard;