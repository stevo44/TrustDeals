import emailjs from '@emailjs/browser';

// =============================================
// EmailJS Configuration
// =============================================
const SERVICE_ID = 'service_ipdathn';
const TEMPLATE_ID = 'template_sfx0eir';
const PUBLIC_KEY = 'UiPPlqTZN_YZSDkxa';

// Initialize EmailJS once
emailjs.init(PUBLIC_KEY);

// =============================================
// SEND DEAL INVITE EMAIL
// Called when buyer creates a deal with a seller
// email that doesn't exist in the system yet
// =============================================
export const sendDealInviteEmail = async ({
  sellerEmail,
  sellerName,
  buyerName,
  productTitle,
  price,
  dealId,
}: {
  sellerEmail: string;
  sellerName: string;
  buyerName: string;
  productTitle: string;
  price: number;
  dealId: string;
}) => {
  const dealLink = `${window.location.origin}/join/${dealId}`;

  const templateParams = {
    seller_email: sellerEmail,
    seller_name: sellerName || 'there',
    buyer_name: buyerName,
    product_title: productTitle,
    price: price.toLocaleString(),
    created_at: new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    deal_link: dealLink,
  };

  await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams);
};
