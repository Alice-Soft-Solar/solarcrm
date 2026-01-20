'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui';

export interface LeadFormData {
  date: string;
  customer_name: string;
  mobile_number: string;
  power_bill: string;
  units: string;
  address: string;
  status: string;
  visit_status: string;
  referrer_name: string;
  executive_id: string;
  latitude: string;
  longitude: string;
}

export interface LeadFormProps {
  initialData?: Partial<LeadFormData>;
  executives?: Array<{ id: string; full_name: string }>;
  isAdmin?: boolean;
  isEditMode?: boolean;
  editingVisitStatus?: string; // Current visit_status when editing
  availableVisitOptions?: string[]; // Available visit options for edit mode
  onPhotoChange?: (file: File | null) => void;
  photoPreview?: string | null;
  onSubmit: (data: LeadFormData, photoFile: File | null) => void;
  onCancel?: () => void;
  saving?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
}

export default function LeadForm({
  initialData = {},
  executives = [],
  isAdmin = false,
  isEditMode = false,
  editingVisitStatus,
  availableVisitOptions = [],
  onPhotoChange,
  photoPreview,
  onSubmit,
  onCancel,
  saving = false,
  submitLabel = 'Save Entry',
  cancelLabel = 'Cancel',
}: LeadFormProps) {
  const [form, setForm] = useState<LeadFormData>({
    date: '',
    customer_name: '',
    mobile_number: '',
    power_bill: '',
    units: '',
    address: '',
    status: 'Interested',
    visit_status: 'First Visit',
    referrer_name: '',
    executive_id: '',
    latitude: '',
    longitude: '',
    ...initialData,
  });

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('📍 Fetching location...');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const locationFetchedRef = useRef(false); // Track if location was already fetched

  // Update form when initialData changes (for edit mode)
  useEffect(() => {
    if (isEditMode && initialData && Object.keys(initialData).length > 0) {
      setForm((prev) => ({
        ...prev,
        ...initialData,
      }));
    }
  }, [initialData, isEditMode]);

  // Prefill date on mount if not in edit mode
  useEffect(() => {
    if (!isEditMode && !form.date) {
      const now = new Date();
      const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setForm((prev) => ({ ...prev, date: localISO }));
    }
  }, [isEditMode, form.date]);

  // Promise-based geolocation with timeout (matching HTML version)
  const getCurrentPositionAsync = useCallback((timeout = 10000): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('No geolocation'));
      }

      // Don't pre-check secure context - let the browser handle it
      // The browser will reject if not in secure context (HTTPS or localhost)
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error('Geolocation timeout'));
      }, timeout);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(pos);
        },
        (err) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          reject(err);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0, // Always get fresh position
        }
      );
    });
  }, []);

  // Fetch location function (matching HTML version)
  // This will automatically trigger the native browser permission dialog
  const fetchLocation = useCallback(async () => {
    try {
      setLocationStatus('📍 Fetching location...');
      setLocationLoading(true);
      
      console.log('Calling getCurrentPositionAsync - this will trigger browser permission dialog');
      console.log('Current URL:', window.location.href);
      console.log('Is secure context:', window.isSecureContext);
      console.log('Hostname:', window.location.hostname);
      
      const pos = await getCurrentPositionAsync(10000);
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      
      console.log('Location captured successfully:', { lat, lng });
      
      setForm((prev) => ({
        ...prev,
        latitude: String(lat),
        longitude: String(lng),
      }));
      
      setLocationStatus('✅ Location captured');
      setLocationLoading(false);
      return true;
    } catch (err: unknown) {
      console.warn('Location error:', err);
      console.warn('Error code:', err instanceof GeolocationPositionError ? err.code : 'N/A');
      console.warn('Error message:', err instanceof Error ? err.message : 'Unknown error');
      
      // More specific error messages
      if (err instanceof Error && err.message && err.message.includes('HTTPS')) {
        // Not in secure context
        setLocationStatus('⚠️ Geolocation requires HTTPS. Please use https:// or localhost.');
      } else if (err instanceof GeolocationPositionError && err.code === 1) {
        // PERMISSION_DENIED
        setLocationStatus('⚠️ Location permission denied. Please allow location access in browser settings.');
      } else if (err instanceof GeolocationPositionError && err.code === 2) {
        // POSITION_UNAVAILABLE
        setLocationStatus('⚠️ Location unavailable. Please check GPS settings.');
      } else if (err instanceof GeolocationPositionError && err.code === 3) {
        // TIMEOUT
        setLocationStatus('⚠️ Location request timed out. Please try again.');
      } else {
        setLocationStatus('⚠️ Allow location access (required)');
      }
      
      setLocationLoading(false);
      return false;
    }
  }, [getCurrentPositionAsync]);

  // Auto-fetch location on mount - triggers native browser permission dialog
  useEffect(() => {
    // Skip if already fetched or in edit mode
    if (locationFetchedRef.current || isEditMode) {
      return;
    }
    
    // Check if location is already captured (non-empty strings)
    if (form.latitude && form.longitude && form.latitude.trim() !== '' && form.longitude.trim() !== '') {
      console.log('Location already captured:', { lat: form.latitude, lng: form.longitude });
      locationFetchedRef.current = true;
      return;
    }

    console.log('Setting up auto-location capture...');
    console.log('navigator.geolocation available:', !!navigator.geolocation);
    
    // Mark as fetched to prevent re-running
    locationFetchedRef.current = true;
    
    // Small delay to ensure page is fully loaded and interactive
    const timer = setTimeout(() => {
      console.log('Auto-triggering location capture');
      fetchLocation();
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [isEditMode, fetchLocation, form.latitude, form.longitude]);

  const handlePhotoClick = () => {
    const input = document.getElementById('lead-photo-input') as HTMLInputElement | null;
    if (input) {
      input.click();
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (onPhotoChange) {
      onPhotoChange(file);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!isEditMode) {
      // Required fields in create mode (except referrer)
      if (!form.customer_name.trim()) {
        errors.customer_name = 'Customer name is required';
      }
      if (!form.mobile_number.trim() || form.mobile_number.length !== 10) {
        errors.mobile_number = 'Valid 10-digit mobile number is required';
      }
      if (!form.power_bill.trim()) {
        errors.power_bill = 'Power bill is required';
      }
      if (!form.units.trim()) {
        errors.units = 'Power units is required';
      }
      if (!form.address.trim()) {
        errors.address = 'Address is required';
      }
      if (!form.latitude.trim() || !form.longitude.trim()) {
        errors.location = 'Location is required. Please allow location access.';
      }
      if (isAdmin && !form.executive_id) {
        errors.executive_id = 'Please select an executive';
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = document.querySelector('.border-red-500');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    
    onSubmit(form, null);
  };

  const handleChange = (field: keyof LeadFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Determine visit status field rendering
  const renderVisitStatusField = () => {
    if (isEditMode && editingVisitStatus) {
      const currentVisitStatus = editingVisitStatus.trim();
      
      if (availableVisitOptions.length === 0) {
        // Already at Third Visit, show as read-only
        return (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">Visit Status</label>
            <input
              type="text"
              value={currentVisitStatus}
              readOnly
              className="block w-full rounded-md border border-border bg-zinc-50 px-3 py-2 text-sm text-foreground"
            />
            <p className="mt-1 text-xs text-foreground opacity-60">
              Maximum visits reached (Third Visit completed)
            </p>
          </div>
        );
      }

      return (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">Visit Status</label>
          <p className="mb-2 text-xs text-foreground opacity-70">
            Current: <span className="font-medium">{currentVisitStatus}</span> → Update to:{' '}
            <span className="font-medium">{availableVisitOptions[0]}</span>
          </p>
          <select
            value={form.visit_status}
            onChange={(e) => handleChange('visit_status', e.target.value)}
            className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground"
          >
            {availableVisitOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // Create mode - show read-only First Visit
    return (
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">8. Visit Status</label>
        <input
          type="text"
          value={form.visit_status}
          readOnly
          className="block w-full rounded-md border border-border bg-zinc-50 px-3 py-2 text-sm text-foreground"
        />
        <p className="mt-1 text-xs text-foreground opacity-60">
          New leads start with "First Visit"
        </p>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
      {!isEditMode && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">1. Date</label>
          <input
            type="datetime-local"
            value={form.date}
            readOnly
            className="block w-full rounded-md border border-border bg-zinc-50 px-3 py-2 text-sm text-foreground"
          />
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {isEditMode ? 'Customer Name' : '2. Customer Name'} {!isEditMode && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={form.customer_name}
          onChange={(e) => handleChange('customer_name', e.target.value)}
          placeholder="John Doe"
          className={`block w-full rounded-md border px-3 py-2 text-sm text-foreground ${
            validationErrors.customer_name ? 'border-red-500 bg-red-50' : 'border-border bg-white'
          }`}
          disabled={isEditMode && !isAdmin}
        />
        {validationErrors.customer_name && (
          <p className="text-xs text-red-500">{validationErrors.customer_name}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {isEditMode ? 'Customer Phone' : '3. Mobile Number'} {!isEditMode && <span className="text-red-500">*</span>}
        </label>
        <div className="flex">
          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-zinc-100 text-sm text-foreground">
            +91
          </span>
          <input
            type="tel"
            value={form.mobile_number}
            onChange={(e) => {
              // Strip any +91/91 prefix and non-digits, keep only 10 digits
              let value = e.target.value.replace(/[^0-9]/g, '');
              // If user pasted number starting with 91 and it's > 10 digits, strip the 91
              if (value.length > 10 && value.startsWith('91')) {
                value = value.slice(2);
              }
              handleChange('mobile_number', value.slice(0, 10));
            }}
            placeholder="10-digit mobile (e.g. 9876543210)"
            maxLength={10}
            className={`block w-full rounded-r-md border px-3 py-2 text-sm text-foreground ${
              validationErrors.mobile_number ? 'border-red-500 bg-red-50' : 'border-border bg-white'
            }`}
            disabled={isEditMode && !isAdmin}
          />
        </div>
        {validationErrors.mobile_number && (
          <p className="text-xs text-red-500">{validationErrors.mobile_number}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {isEditMode ? 'Power Bill' : '4. Power Bill (₹)'} {!isEditMode && <span className="text-red-500">*</span>}
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.power_bill}
            onChange={(e) => handleChange('power_bill', e.target.value)}
            placeholder="320.50"
            className={`block w-full rounded-md border px-3 py-2 text-sm text-foreground ${
              validationErrors.power_bill ? 'border-red-500 bg-red-50' : 'border-border bg-white'
            }`}
            disabled={isEditMode && !isAdmin}
          />
          {validationErrors.power_bill && (
            <p className="text-xs text-red-500">{validationErrors.power_bill}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {isEditMode ? 'Power Units' : '5. Units (kWh)'} {!isEditMode && <span className="text-red-500">*</span>}
          </label>
          <input
            type="number"
            min={0}
            step="0.1"
            value={form.units}
            onChange={(e) => handleChange('units', e.target.value)}
            placeholder="280"
            className={`block w-full rounded-md border px-3 py-2 text-sm text-foreground ${
              validationErrors.units ? 'border-red-500 bg-red-50' : 'border-border bg-white'
            }`}
            disabled={isEditMode && !isAdmin}
          />
          {validationErrors.units && (
            <p className="text-xs text-red-500">{validationErrors.units}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {isEditMode ? 'Address' : '6. Address'} {!isEditMode && <span className="text-red-500">*</span>}
        </label>
        <textarea
          rows={2}
          value={form.address}
          onChange={(e) => handleChange('address', e.target.value)}
          placeholder="Street, City, State"
          className={`block w-full rounded-md border px-3 py-2 text-sm text-foreground ${
            validationErrors.address ? 'border-red-500 bg-red-50' : 'border-border bg-white'
          }`}
          disabled={isEditMode && !isAdmin}
        />
        {validationErrors.address && (
          <p className="text-xs text-red-500">{validationErrors.address}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {isEditMode ? 'Status' : '7. Status'}
          </label>
          <select
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground"
          >
            <option value="Interested">Interested</option>
            <option value="Not Interested">Not Interested</option>
            <option value="Reference">Reference</option>
            <option value="Follow Up Required">Follow Up Required</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
        {renderVisitStatusField()}
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {isEditMode ? 'Referer' : '9. Referrer'}
        </label>
        <input
          type="text"
          value={form.referrer_name}
          onChange={(e) => handleChange('referrer_name', e.target.value)}
          placeholder="Name of referrer"
          className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground"
          disabled={isEditMode && !isAdmin}
        />
      </div>

      {isAdmin && !isEditMode && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            10. Executive <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={form.executive_id}
            onChange={(e) => handleChange('executive_id', e.target.value)}
            className={`block w-full rounded-md border px-3 py-2 text-sm text-foreground ${
              validationErrors.executive_id ? 'border-red-500 bg-red-50' : 'border-border bg-white'
            }`}
          >
            <option value="">Select Executive</option>
            {executives.map((exec) => (
              <option key={exec.id} value={exec.id}>
                {exec.full_name}
              </option>
            ))}
          </select>
          {validationErrors.executive_id && (
            <p className="text-xs text-red-500">{validationErrors.executive_id}</p>
          )}
        </div>
      )}

      {!isEditMode && (
        <>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">11. Capture Photo (Selfie)</label>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button type="button" variant="outline" size="sm" onClick={handlePhotoClick}>
                📸 Capture Photo
              </Button>
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Lead selfie preview"
                  className="h-20 w-20 rounded-full object-cover border border-zinc-200"
                />
              )}
            </div>
            <input
              id="lead-photo-input"
              type="file"
              accept="image/*"
              capture="user"
              hidden
              onChange={handlePhotoChange}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">12. Location Coordinates <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                readOnly
                value={form.latitude}
                placeholder="Latitude"
                className={`block w-full rounded-md border px-3 py-2 text-sm text-foreground cursor-not-allowed ${
                  validationErrors.location ? 'border-red-500 bg-red-50' : 'border-border bg-zinc-50'
                }`}
              />
              <input
                type="text"
                readOnly
                value={form.longitude}
                placeholder="Longitude"
                className={`block w-full rounded-md border px-3 py-2 text-sm text-foreground cursor-not-allowed ${
                  validationErrors.location ? 'border-red-500 bg-red-50' : 'border-border bg-zinc-50'
                }`}
              />
            </div>
            <p className={`mt-1 text-xs ${validationErrors.location ? 'text-red-500' : 'text-muted-foreground'}`}>
              {validationErrors.location || locationStatus}
            </p>
            {!form.latitude && !form.longitude && !locationLoading && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  locationFetchedRef.current = false;
                  fetchLocation();
                }}
                className="mt-2"
              >
                🔄 Retry Location
              </Button>
            )}
          </div>
        </>
      )}

      <div className="pt-2 flex justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            {cancelLabel}
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          size={isEditMode ? "sm" : "md"}
          disabled={saving}
          className={!isEditMode ? "w-full" : ""}
        >
          {saving ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
