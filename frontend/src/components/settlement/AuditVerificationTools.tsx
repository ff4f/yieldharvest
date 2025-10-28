import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Input from '@/components/ui/Input';
import { 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  ExternalLink,
  Search,
  Filter,
  Download,
  Eye,
  Clock,
  Hash,
  FileText,
  MessageSquare,
  Coins
} from 'lucide-react';
import { AuditEvent } from '@/services/settlementsAggregator';
import { formatDate } from '@/lib/utils';

interface AuditVerificationToolsProps {
  auditTrail: AuditEvent[];
  isLoading?: boolean;
}

const EVENT_TYPE_CONFIG = {
  created: {
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    badgeColor: 'bg-blue-100 text-blue-800',
    label: 'Created'
  },
  funded: {
    icon: Coins,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    badgeColor: 'bg-green-100 text-green-800',
    label: 'Funded'
  },
  distributed: {
    icon: MessageSquare,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    badgeColor: 'bg-purple-100 text-purple-800',
    label: 'Distributed'
  },
  completed: {
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    badgeColor: 'bg-emerald-100 text-emerald-800',
    label: 'Completed'
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    badgeColor: 'bg-red-100 text-red-800',
    label: 'Failed'
  }
};

const VERIFICATION_STATUS_CONFIG = {
  verified: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100 text-green-800',
    label: 'Verified'
  },
  pending: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100 text-yellow-800',
    label: 'Pending'
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100 text-red-800',
    label: 'Failed'
  }
};

export const AuditVerificationTools: React.FC<AuditVerificationToolsProps> = ({
  auditTrail,
  isLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [selectedVerificationStatus, setSelectedVerificationStatus] = useState<string>('all');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // Filter audit events
  const filteredEvents = auditTrail.filter(event => {
    const matchesSearch = searchTerm === '' || 
      event.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.settlementId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.transactionId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEventType = selectedEventType === 'all' || event.eventType === selectedEventType;
    const matchesVerificationStatus = selectedVerificationStatus === 'all' || event.verificationStatus === selectedVerificationStatus;
    
    return matchesSearch && matchesEventType && matchesVerificationStatus;
  });

  const handleExportAuditLog = () => {
    const csvContent = [
      ['Timestamp', 'Event Type', 'Settlement ID', 'Details', 'Transaction ID', 'Verification Status', 'HashScan URL'].join(','),
      ...filteredEvents.map(event => [
        event.timestamp,
        event.eventType,
        event.settlementId,
        `"${event.details}"`,
        event.transactionId || '',
        event.verificationStatus,
        event.hashScanUrl || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getVerificationSummary = () => {
    const total = auditTrail.length;
    const verified = auditTrail.filter(e => e.verificationStatus === 'verified').length;
    const pending = auditTrail.filter(e => e.verificationStatus === 'pending').length;
    const failed = auditTrail.filter(e => e.verificationStatus === 'failed').length;
    
    return { total, verified, pending, failed };
  };

  const summary = getVerificationSummary();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-48"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Verification Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Events</p>
                <p className="text-xl font-bold">{summary.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Verified</p>
                <p className="text-xl font-bold text-green-600">{summary.verified}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-xl font-bold text-yellow-600">{summary.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-xl font-bold text-red-600">{summary.failed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-600" />
              Audit Trail & Verification
            </div>
            <Button onClick={handleExportAuditLog} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Log
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by settlement ID, transaction ID, or details..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <select
              value={selectedEventType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedEventType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Event Types</option>
              {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            
            <select
              value={selectedVerificationStatus}
              onChange={(e) => setSelectedVerificationStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              {Object.entries(VERIFICATION_STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          {/* Audit Events List */}
          <div className="space-y-3">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No audit events found matching your criteria.</p>
              </div>
            ) : (
              filteredEvents.map((event) => {
                const eventConfig = EVENT_TYPE_CONFIG[event.eventType];
                const verificationConfig = VERIFICATION_STATUS_CONFIG[event.verificationStatus];
                const EventIcon = eventConfig.icon;
                const VerificationIcon = verificationConfig.icon;
                const isExpanded = expandedEvent === event.id;

                return (
                  <div key={event.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className={`p-2 rounded-lg ${eventConfig.bgColor}`}>
                          <EventIcon className={`h-4 w-4 ${eventConfig.color}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={eventConfig.badgeColor}>
                              {eventConfig.label}
                            </Badge>
                            <Badge className={verificationConfig.bgColor}>
                              <VerificationIcon className={`h-3 w-3 mr-1 ${verificationConfig.color}`} />
                              {verificationConfig.label}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {formatDate(event.timestamp)}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-900 mb-1">{event.details}</p>
                          <p className="text-xs text-gray-500">Settlement: {event.settlementId}</p>
                          
                          {event.transactionId && (
                            <div className="flex items-center gap-2 mt-2">
                              <Hash className="h-3 w-3 text-gray-400" />
                              <span className="text-xs font-mono text-gray-600">
                                {event.transactionId}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {event.hashScanUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(event.hashScanUrl, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            HashScan
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t bg-gray-50 rounded-lg p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-medium text-gray-700">Event Details</p>
                            <p className="text-gray-600">ID: {event.id}</p>
                            <p className="text-gray-600">Type: {event.eventType}</p>
                            <p className="text-gray-600">Timestamp: {event.timestamp}</p>
                          </div>
                          
                          <div>
                            <p className="font-medium text-gray-700">Verification</p>
                            <p className="text-gray-600">Status: {event.verificationStatus}</p>
                            {event.transactionId && (
                              <p className="text-gray-600 break-all">
                                Transaction: {event.transactionId}
                              </p>
                            )}
                            {event.hashScanUrl && (
                              <a 
                                href={event.hashScanUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                View on HashScan →
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          
          {filteredEvents.length > 0 && (
            <div className="mt-6 text-center text-sm text-gray-500">
              Showing {filteredEvents.length} of {auditTrail.length} audit events
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditVerificationTools;