'use client';

import { useState, useEffect, useCallback } from 'react';
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
    console.log('Location useEffect running...', { isEditMode, latitude: form.latitude, longitude: form.longitude });
    
    if (isEditMode) {
      console.log('Edit mode - skipping location capture');
      return;
    }
    
    // Check if location is already captured (non-empty strings)
    if (form.latitude && form.longitude && form.latitude.trim() !== '' && form.longitude.trim() !== '') {
      console.log('Location already captured:', { lat: form.latitude, lng: form.longitude });
      return;
    }

    console.log('Setting up auto-location capture...');
    console.log('navigator.geolocation available:', !!navigator.geolocation);
    
    // Small delay to ensure page is fully loaded and interactive
    // This ensures the browser permission dialog can be displayed
    const timer = setTimeout(() => {
      console.log('Auto-triggering location capture - browser dialog should appear now');
      console.log('About to call fetchLocation()...');
      fetchLocation();
    }, 500); // 500ms delay for mobile browsers

    return () => {
      console.log('Cleaning up location timer');
      clearTimeout(timer);
    };
  }, [isEditMode, fetchLocation]); // Removed form.latitude/longitude from deps to prevent re-triggering

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form, null);
  };

  const handleChange = (field: keyof LeadFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
          {isEditMode ? 'Customer Name' : '2. Customer Name'}
        </label>
        <input
          type="text"
          required={!isEditMode}
          value={form.customer_name}
          onChange={(e) => handleChange('customer_name', e.target.value)}
          placeholder="John Doe"
          className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground"
          disabled={isEditMode && !isAdmin}
        />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {isEditMode ? 'Customer Phone' : '3. Mobile Number'}
        </label>
        <input
          type="tel"
          required={!isEditMode}
          value={form.mobile_number}
          onChange={(e) =>
            handleChange('mobile_number', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))
          }
          placeholder="10-digit mobile (e.g. 9876543210)"
          maxLength={10}
          className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground"
          disabled={isEditMode && !isAdmin}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {isEditMode ? 'Power Bill' : '4. Power Bill (₹)'}
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.power_bill}
            onChange={(e) => handleChange('power_bill', e.target.value)}
            placeholder="320.50"
            className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground"
            disabled={isEditMode && !isAdmin}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {isEditMode ? 'Power Units' : '5. Units (kWh)'}
          </label>
          <input
            type="number"
            min={0}
            step="0.1"
            value={form.units}
            onChange={(e) => handleChange('units', e.target.value)}
            placeholder="280"
            className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground"
            disabled={isEditMode && !isAdmin}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {isEditMode ? 'Address' : '6. Address'}
        </label>
        <textarea
          rows={2}
          value={form.address}
          onChange={(e) => handleChange('address', e.target.value)}
          placeholder="Street, City, State"
          className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground"
          disabled={isEditMode && !isAdmin}
        />
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
          <label className="block text-sm font-medium text-foreground">10. Executive</label>
          <select
            required
            value={form.executive_id}
            onChange={(e) => handleChange('executive_id', e.target.value)}
            className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground"
          >
            <option value="">Select Executive</option>
            {executives.map((exec) => (
              <option key={exec.id} value={exec.id}>
                {exec.full_name}
              </option>
            ))}
          </select>
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
            <label className="block text-sm font-medium text-foreground">12. Location Coordinates</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                readOnly
                value={form.latitude}
                placeholder="Latitude"
                className="block w-full rounded-md border border-border bg-zinc-50 px-3 py-2 text-sm text-foreground cursor-not-allowed"
              />
              <input
                type="text"
                readOnly
                value={form.longitude}
                placeholder="Longitude"
                className="block w-full rounded-md border border-border bg-zinc-50 px-3 py-2 text-sm text-foreground cursor-not-allowed"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {locationStatus}
            </p>
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
