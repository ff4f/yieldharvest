import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';

const DealFilters = ({ onFiltersChange, savedSearches = [] }) => {
  const [filters, setFilters] = useState({
    riskScore: '',
    aprRange: '',
    tenor: '',
    dealSize: '',
    searchTerm: ''
  });

  const [isExpanded, setIsExpanded] = useState(true);

  const riskScoreOptions = [
    { value: '', label: 'All Risk Levels' },
    { value: 'low', label: 'Low Risk (A+, A)' },
    { value: 'medium', label: 'Medium Risk (B+, B)' },
    { value: 'high', label: 'High Risk (C+, C)' }
  ];

  const aprRangeOptions = [
    { value: '', label: 'All APR Ranges' },
    { value: '0-5', label: '0% - 5%' },
    { value: '5-10', label: '5% - 10%' },
    { value: '10-15', label: '10% - 15%' },
    { value: '15+', label: '15%+' }
  ];

  const tenorOptions = [
    { value: '', label: 'All Tenors' },
    { value: '30', label: '30 days' },
    { value: '60', label: '60 days' },
    { value: '90', label: '90 days' },
    { value: '120', label: '120+ days' }
  ];

  const dealSizeOptions = [
    { value: '', label: 'All Deal Sizes' },
    { value: '0-50k', label: '$0 - $50K' },
    { value: '50k-100k', label: '$50K - $100K' },
    { value: '100k-250k', label: '$100K - $250K' },
    { value: '250k+', label: '$250K+' }
  ];

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      riskScore: '',
      aprRange: '',
      tenor: '',
      dealSize: '',
      searchTerm: ''
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const handleSaveSearch = () => {
    // Mock save search functionality
    console.log('Saving search with filters:', filters);
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,.06)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Deal Filters</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Icon name={isExpanded ? "ChevronUp" : "ChevronDown"} size={16} />
        </Button>
      </div>
      {/* Filter Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Search Input */}
          <Input
            type="search"
            placeholder="Search deals..."
            value={filters?.searchTerm}
            onChange={(e) => handleFilterChange('searchTerm', e?.target?.value)}
            className="mb-4"
          />

          {/* Risk Score Filter */}
          <Select
            label="Risk Score"
            options={riskScoreOptions}
            value={filters?.riskScore}
            onChange={(value) => handleFilterChange('riskScore', value)}
          />

          {/* APR Range Filter */}
          <Select
            label="APR Range"
            options={aprRangeOptions}
            value={filters?.aprRange}
            onChange={(value) => handleFilterChange('aprRange', value)}
          />

          {/* Tenor Filter */}
          <Select
            label="Tenor"
            options={tenorOptions}
            value={filters?.tenor}
            onChange={(value) => handleFilterChange('tenor', value)}
          />

          {/* Deal Size Filter */}
          <Select
            label="Deal Size"
            options={dealSizeOptions}
            value={filters?.dealSize}
            onChange={(value) => handleFilterChange('dealSize', value)}
          />

          {/* Action Buttons */}
          <div className="flex flex-col space-y-2 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={handleClearFilters}
              iconName="X"
              iconPosition="left"
              fullWidth
            >
              Clear Filters
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveSearch}
              iconName="Bookmark"
              iconPosition="left"
              fullWidth
            >
              Save Search
            </Button>
          </div>

          {/* Saved Searches */}
          {savedSearches?.length > 0 && (
            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-medium text-foreground mb-2">Saved Searches</h4>
              <div className="space-y-1">
                {savedSearches?.map((search, index) => (
                  <button
                    key={index}
                    className="flex items-center justify-between w-full p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-institutional"
                  >
                    <span>{search?.name}</span>
                    <Icon name="ChevronRight" size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DealFilters;