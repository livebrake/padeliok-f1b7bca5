/** Issue an invoice independently of the email marker, then deliver under a retryable lease. */
export async function fulfillPaidOrder(orderId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: invoice, error: invoiceError } = await supabaseAdmin.rpc('issue_invoice', { order_uuid: orderId });
  if (invoiceError || !invoice) throw invoiceError ?? new Error('Nepavyko išrašyti sąskaitos.');

  const claimedAt = new Date().toISOString();
  const staleAt = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: order, error: claimError } = await supabaseAdmin.from('orders')
    .update({ payment_email_claimed_at: claimedAt })
    .eq('id', orderId).eq('payment_status', 'PAID').is('payment_email_sent_at', null)
    .or(`payment_email_claimed_at.is.null,payment_email_claimed_at.lt.${staleAt}`)
    .select('*').maybeSingle();
  if (claimError) throw claimError;
  if (!order) return;

  try {
    const fileLinks: { name: string; url: string }[] = [];
    for (const path of order.file_paths) {
      const { data } = await supabaseAdmin.storage.from('order-documents').createSignedUrl(path, 60 * 60 * 24 * 7);
      if (data?.signedUrl) fileLinks.push({ name: path.split('/').pop()?.slice(9) || 'Dokumentas', url: data.signedUrl });
    }
    const isCompany = order.client_type === 'company' || order.client_type === 'juridinis';
    const { sendOrderEmails } = await import('@/lib/order-emails.server');
    await sendOrderEmails({
      orderNumber: order.order_number, isCompany, fullName: order.full_name ?? '', email: order.email, phone: order.phone,
      planName: order.plan_name, price: Number(order.price), projectGoal: order.project_goal ?? '', comment: order.comment ?? '',
      company: isCompany ? { company_name: order.company_name ?? '', company_code: order.company_code ?? '',
        company_address: order.company_address, vat_code: order.vat_code ?? '' } : null,
      fileLinks, invoice,
    });
    const { error } = await supabaseAdmin.from('orders')
      .update({ payment_email_sent_at: new Date().toISOString(), payment_email_claimed_at: null })
      .eq('id', orderId).eq('payment_email_claimed_at', claimedAt);
    if (error) throw error;
  } catch (error) {
    // Failed sends must not permanently consume the slot; provider idempotency protects retries.
    const { error: releaseError } = await supabaseAdmin.from('orders').update({ payment_email_claimed_at: null })
      .eq('id', orderId).eq('payment_email_claimed_at', claimedAt);
    if (releaseError) console.error('payment email lease release failed', releaseError);
    throw error;
  }
}