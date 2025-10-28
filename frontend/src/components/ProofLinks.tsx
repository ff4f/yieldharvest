import React from 'react';
import { ExternalLink, FileText, Hash, MessageSquare, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProofLink } from '@/types/api';

interface ProofLinksProps {
  proofLinks: ProofLink[];
  title?: string;
  compact?: boolean;
}

const getProofIcon = (type: ProofLink['type']) => {
  switch (type) {
    case 'hts':
      return <Hash className="h-4 w-4" />;
    case 'hfs':
      return <FileText className="h-4 w-4" />;
    case 'hcs':
      return <MessageSquare className="h-4 w-4" />;
    case 'hashscan':
      return <Eye className="h-4 w-4" />;
    case 'mirror':
      return <ExternalLink className="h-4 w-4" />;
    default:
      return <ExternalLink className="h-4 w-4" />;
  }
};

const getProofColor = (type: ProofLink['type']) => {
  switch (type) {
    case 'hts':
      return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
    case 'hfs':
      return 'bg-green-100 text-green-800 hover:bg-green-200';
    case 'hcs':
      return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
    case 'hashscan':
      return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
    case 'mirror':
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
  }
};

export const ProofLinks: React.FC<ProofLinksProps> = ({ 
  proofLinks, 
  title = "On-Chain Proofs", 
  compact = false 
}) => {
  if (!proofLinks || proofLinks.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {proofLinks.map((link, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className={`h-8 px-2 ${getProofColor(link.type)}`}
            onClick={() => window.open(link.url, '_blank')}
          >
            {getProofIcon(link.type)}
            <span className="ml-1 text-xs">{link.label}</span>
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        ))}
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Hash className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {proofLinks.map((link, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md ${getProofColor(link.type)}`}>
                  {getProofIcon(link.type)}
                </div>
                <div>
                  <div className="font-medium text-sm">{link.label}</div>
                  {link.hash && (
                    <div className="text-xs text-gray-500 font-mono">
                      {link.hash}
                    </div>
                  )}
                  {link.timestamp && (
                    <div className="text-xs text-gray-400">
                      {new Date(link.timestamp).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(link.url, '_blank')}
                className="text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const ProofBadges: React.FC<{ proofLinks: ProofLink[] }> = ({ proofLinks }) => {
  if (!proofLinks || proofLinks.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {proofLinks.map((link, index) => (
        <Badge
          key={index}
          variant="secondary"
          className={`cursor-pointer text-xs ${getProofColor(link.type)}`}
          onClick={() => window.open(link.url, '_blank')}
        >
          {getProofIcon(link.type)}
          <span className="ml-1">{link.type.toUpperCase()}</span>
        </Badge>
      ))}
    </div>
  );
};

export default ProofLinks;