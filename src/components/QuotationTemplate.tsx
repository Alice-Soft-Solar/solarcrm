import React from 'react';

interface QuotationData {
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
}

interface QuotationTemplateProps {
  data: QuotationData;
}

const QuotationTemplate: React.FC<QuotationTemplateProps> = ({ data }) => {
  // Format date from YYYY-MM-DD to DD-MMM-YY
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  };

  // Format amount with commas
  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div
      id="quotation-template"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm',
        margin: '0 auto',
        backgroundColor: 'white',
        fontFamily: 'Times New Roman, serif',
        fontSize: '12pt',
        lineHeight: '1.5',
        color: '#000',
      }}
    >
      {/* Header: WORK ORDER */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '18pt', fontWeight: 'bold', margin: '0' }}>WORK ORDER</h1>
      </div>

      {/* From and Date section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '5px' }}>
            <strong>From</strong>
          </div>
          <div style={{ marginBottom: '2px' }}>
            <strong>{data.customer_name}</strong>
          </div>
          <div style={{ marginBottom: '2px' }}>{data.customer_address}</div>
          <div style={{ marginBottom: '2px' }}>{data.customer_city}</div>
          <div style={{ marginBottom: '2px' }}>Phone : {data.customer_phone}</div>
        </div>

        <div style={{ textAlign: 'right', minWidth: '150px' }}>
          <div>
            <strong>Date :</strong> {formatDate(data.quotation_date)}
          </div>
        </div>
      </div>

      {/* To section */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ marginBottom: '5px' }}>
          <strong>To</strong>
        </div>
        <div style={{ marginBottom: '2px' }}>
          <strong>G M SOLAR SYSTEMS</strong>
        </div>
        <div style={{ marginBottom: '2px' }}>2ndFloor, Naga Sai Complex</div>
        <div style={{ marginBottom: '2px' }}>Opp.Stall Girls High School,</div>
        <div style={{ marginBottom: '2px' }}>Nagarampalem,</div>
        <div style={{ marginBottom: '2px' }}>Guntur-522004</div>
        <div style={{ marginBottom: '2px' }}>Andhra Pradesh.</div>
      </div>

      {/* Main description paragraph */}
      <div style={{ marginBottom: '30px', textAlign: 'justify' }}>
        Work Order for EPC (engineering Procurement and commissioning) of{' '}
        <strong>{data.plant_capacity} {data.system_type}</strong>  {data.roof_type} Rooftop Solar Power
        plant at our premises rooftop. Total cost of the project Rs.{' '}
        <strong>{formatAmount(data.order_amount)}</strong> including Transport and all taxes.
      </div>

      {/* Supply of Materials */}
      <div style={{ marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '200px', verticalAlign: 'top', paddingRight: '20px' }}>
                <strong>Supply of Materials :</strong>
              </td>
              <td style={{ verticalAlign: 'top' }}>
                <strong>{data.panel_brand} {data.plant_capacity} {data.system_type}</strong>
                <br />
                {data.components_list || '(TATA Panels, Inverter, Cables, ACDC box, and Structure)'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* GMSOLAR Scope of Work */}
      <div style={{ marginBottom: '30px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '200px', verticalAlign: 'top', paddingRight: '20px' }}>
                <strong>GMSOLAR Scope of Work :</strong>
              </td>
              <td style={{ verticalAlign: 'top' }}>
                {data.scope_of_work || 'Technical Feasibility, Transport, Erection, Installation, Testing and Commissioning, Civil works and Subsidy status follow-up.'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payment Terms */}
      <div style={{ marginBottom: '15px' }}>
        <strong>Payment : {data.payment_terms}</strong>
      </div>

      {/* Delivery & Commissioning */}
      <div style={{ marginBottom: '15px' }}>
        <strong>Delivery & Commissioning :</strong> Within {data.delivery_days} days from the date of your confirmation of order.
      </div>

      {/* Warranty */}
      <div style={{ marginBottom: '60px' }}>
        <strong>Warranty :</strong> {data.warranty_years} Years on Supplied Equipment's
      </div>

      {/* Footer with signature */}
      <div style={{ marginTop: '80px' }}>
        <div style={{ textAlign: 'right', fontStyle: 'italic', marginBottom: '40px' }}>
          Yours Sincerely
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ marginBottom: '5px', fontStyle: 'italic' }}>Signature</div>
          <div>
            <strong>{data.customer_name}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationTemplate;
