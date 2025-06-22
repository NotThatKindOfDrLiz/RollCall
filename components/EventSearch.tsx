import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';

export interface EventFilters {
  searchTerm: string;
  category: string;
  dateRange: string;
  location: string;
  tags: string[];
}

interface EventSearchProps {
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  availableCategories: string[];
  availableTags: string[];
  className?: string;
}

export function EventSearch({ 
  filters, 
  onFiltersChange, 
  availableCategories, 
  availableTags,
  className 
}: EventSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof EventFilters, value: string | string[]) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      searchTerm: '',
      category: '',
      dateRange: '',
      location: '',
      tags: []
    });
  };

  const addTag = (tag: string) => {
    if (!filters.tags.includes(tag)) {
      updateFilter('tags', [...filters.tags, tag]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateFilter('tags', filters.tags.filter(tag => tag !== tagToRemove));
  };

  const hasActiveFilters = filters.searchTerm || 
    filters.category || 
    filters.dateRange || 
    filters.location || 
    filters.tags.length > 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
          Search Events
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search events by title, description, or tags..."
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            className="pl-10 pr-10"
          />
          {filters.searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilter('searchTerm', '')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="border-slate-200 dark:border-slate-600"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-slate-500 hover:text-slate-700"
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Active Tags */}
        {filters.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filters.tags.map(tag => (
              <Badge 
                key={tag} 
                variant="secondary"
                className="cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                onClick={() => removeTag(tag)}
              >
                {tag}
                <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}

        {/* Expanded Filters */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Category
              </label>
              <Select value={filters.category} onValueChange={(value) => updateFilter('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {availableCategories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Date Range
              </label>
              <Select value={filters.dateRange} onValueChange={(value) => updateFilter('dateRange', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="this-week">This week</SelectItem>
                  <SelectItem value="this-month">This month</SelectItem>
                  <SelectItem value="next-month">Next month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Location Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Location
              </label>
              <Input
                placeholder="Filter by location..."
                value={filters.location}
                onChange={(e) => updateFilter('location', e.target.value)}
              />
            </div>

            {/* Tags Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Popular Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {availableTags.slice(0, 10).map(tag => (
                  <Badge 
                    key={tag} 
                    variant={filters.tags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => filters.tags.includes(tag) ? removeTag(tag) : addTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 