'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { getAccessToken } from '@/lib/supabase-client';

interface Quotation {
  id: string;
  quotation_number: string;
  quotation_date: string;
  customer_name: string;
  customer_address: string;
  customer_city: string;
  customer_phone: string;
  plant_capacity: string;
  system_type: string;
  roof_type?: string;
  order_amount: string;
  panel_brand: string;
  payment_terms: string;
  delivery_days: string;
  warranty_years: string;
  components_list?: string;
  scope_of_work?: string;
  status: string;
  pdf_url?: string;
  created_at: string;
  created_by_profile?: {
    full_name: string;
  };
}

export default function QuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_address: '',
    customer_city: '',
    customer_phone: '',
    plant_capacity: '',
    system_type: '',
    roof_type: '',
    order_amount: '',
    panel_brand: '',
    payment_terms: '90% BEFORE WORKSTART & 10% AFTER COMPLETION',
    delivery_days: '30 to 60',
    warranty_years: '5',
  });

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/quotations/list', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch quotations');
      
      const data = await response.json();
      setQuotations(data.quotations || []);
    } catch (error) {
      console.error('Error fetching quotations:', error);
      alert('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.customer_name || !formData.customer_phone || !formData.order_amount || !formData.panel_brand) {
      alert('Please fill all required fields');
      return;
    }

    setCreateLoading(true);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/quotations/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to create quotation');

      const data = await response.json();
      
      // Reset form and close modal
      setFormData({
        customer_name: '',
        customer_address: '',
        customer_city: '',
        customer_phone: '',
        plant_capacity: '',
        system_type: '',
        roof_type: '',
        order_amount: '',
        panel_brand: '',
        payment_terms: '90% BEFORE WORKSTART & 10% AFTER COMPLETION',
        delivery_days: '30 to 60',
        warranty_years: '5',
      });
      setIsCreateModalOpen(false);
      
      // Refresh list
      fetchQuotations();
      
      // Show success message
      if (data.quotation?.pdf_url) {
        alert(`Quotation ${data.quotation.quotation_number} created with PDF!`);
      } else {
        alert(`Quotation ${data.quotation?.quotation_number || ''} created successfully!`);
      }
    } catch (error) {
      console.error('Error creating quotation:', error);
      alert('Failed to create quotation');
    } finally {
      setCreateLoading(false);
    }
  };

  const generatePDF = async (quotation: Quotation): Promise<string | null> => {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/quotations/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ quotation_id: quotation.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate PDF');
      }

      const data = await response.json();
      return data.pdf_url;
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
      return null;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quotation?')) return;

    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`/api/quotations/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete quotation');
      }

      fetchQuotations();
      alert('Quotation deleted successfully');
    } catch (error) {
      console.error('Error deleting quotation:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete quotation');
    }
  };

  // Get signed URL for PDF from storage
  const getSignedPdfUrl = async (pdfPath: string): Promise<string | null> => {
    try {
      const accessToken = await getAccessToken();
      const response = await fetch('/api/quotations/get-pdf-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ pdf_path: pdfPath }),
      });

      if (!response.ok) {
        console.error('Failed to get PDF URL');
        return null;
      }

      const data = await response.json();
      return data.signed_url;
    } catch (error) {
      console.error('Error getting PDF URL:', error);
      return null;
    }
  };

  const handleViewPDF = async (quotation: Quotation) => {
    if (!quotation.pdf_url) {
      alert('PDF not generated yet');
      return;
    }

    const signedUrl = await getSignedPdfUrl(quotation.pdf_url);
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    } else {
      alert('Failed to get PDF URL');
    }
  };

  const handleDownloadPDF = async (quotation: Quotation) => {
    // If PDF already exists, get signed URL and open it
    if (quotation.pdf_url) {
      const signedUrl = await getSignedPdfUrl(quotation.pdf_url);
      if (signedUrl) {
        // Create a link to download
        const link = document.createElement('a');
        link.href = signedUrl;
        link.download = `${quotation.quotation_number}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert('Failed to get PDF URL');
      }
      return;
    }
    
    // Otherwise, generate new PDF
    const pdfPath = await generatePDF(quotation);
    if (pdfPath) {
      const signedUrl = await getSignedPdfUrl(pdfPath);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      }
      // Refresh list to show updated pdf_url
      fetchQuotations();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <PageHeader
        title="Quotations"
        subtitle="Manage work order quotations"
        rightAction={
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#0BC28E] text-white px-6 py-3 rounded-lg hover:bg-[#0aa578] transition-colors font-medium"
          >
            + Create Quotation
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0BC28E]"></div>
            <p className="mt-4 text-gray-600">Loading quotations...</p>
          </div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">No quotations found. Create your first quotation!</p>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quotation #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {quotations.map((quotation) => (
                  <tr key={quotation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {quotation.quotation_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>{quotation.customer_name}</div>
                      <div className="text-gray-500 text-xs">{quotation.customer_phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {quotation.plant_capacity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{parseFloat(quotation.order_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(quotation.quotation_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        quotation.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                        quotation.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                        quotation.status === 'accepted' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {quotation.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 flex items-center">
                      {/* View PDF Icon */}
                      {quotation.pdf_url ? (
                        <button
                          onClick={() => handleViewPDF(quotation)}
                          className="text-blue-600 hover:text-blue-800"
                          title="View PDF"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-gray-300" title="PDF not generated">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </span>
                      )}
                      
                      {/* Download PDF Icon */}
                      {quotation.pdf_url ? (
                        <a
                          href={quotation.pdf_url}
                          download={`${quotation.quotation_number}.pdf`}
                          className="text-[#0BC28E] hover:text-[#0aa578]"
                          title="Download PDF"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                      ) : (
                        <button
                          onClick={() => handleDownloadPDF(quotation)}
                          className="text-yellow-600 hover:text-yellow-800"
                          title="Generate PDF"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                      )}
                      
                      {/* Delete Icon */}
                      <button
                        onClick={() => handleDelete(quotation.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Quotation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Create New Quotation</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateQuotation} className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0BC28E]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0BC28E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Address *
                </label>
                <textarea
                  required
                  rows={2}
                  value={formData.customer_address}
                  onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0BC28E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer City *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customer_city}
                    onChange={(e) => setFormData({ ...formData, customer_city: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0BC28E]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plant Capacity *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 3KW"
                    value={formData.plant_capacity}
                    onChange={(e) => setFormData({ ...formData, plant_capacity: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0BC28E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    System Type *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., DCR NEW"
                    value={formData.system_type}
                    onChange={(e) => setFormData({ ...formData, system_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0BC28E]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Roof Type
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., RCC, Iron Shed"
                    value={formData.roof_type}
                    onChange={(e) => setFormData({ ...formData, roof_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0BC28E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={formData.order_amount}
                    onChange={(e) => setFormData({ ...formData, order_amount: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0BC28E]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Panel Brand *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., TATA POWER SOLAR"
                    value={formData.panel_brand}
                    onChange={(e) => setFormData({ ...formData, panel_brand: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0BC28E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Terms
                </label>
                <input
                  type="text"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0BC28E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Days
                  </label>
                  <input
                    type="text"
                    value={formData.delivery_days}
                    onChange={(e) => setFormData({ ...formData, delivery_days: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0BC28E]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warranty Years
                  </label>
                  <input
                    type="text"
                    value={formData.warranty_years}
                    onChange={(e) => setFormData({ ...formData, warranty_years: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0BC28E]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-6 py-2 bg-[#0BC28E] text-white rounded-lg hover:bg-[#0aa578] disabled:opacity-50"
                >
                  {createLoading ? 'Creating...' : 'Generate PDF & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
