import { resend, FROM_EMAIL } from "./client";

export async function sendWelcomeEmail(email: string, name: string, accountType: string) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Welcome to EyesWide${accountType === "brand" ? " - Your 3-day trial starts now!" : "!"}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #111;">Welcome to EyesWide, ${name}!</h1>
          ${
            accountType === "creator"
              ? `
            <p>You're all set up as a creator. Brands can now find you and send PR package offers.</p>
            <p>Here's what to do next:</p>
            <ul>
              <li>Complete your profile with a great bio</li>
              <li>Add all your social media accounts</li>
              <li>Make sure your availability is turned on</li>
            </ul>
          `
              : `
            <p>Your brand account is ready and your <strong>3-day free trial</strong> has started.</p>
            <p>Here's what to do next:</p>
            <ul>
              <li>Browse our creator directory</li>
              <li>Send your first PR package offer</li>
              <li>Set up billing before your trial ends</li>
            </ul>
          `
          }
          <p style="margin-top: 20px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard"
               style="background-color: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Go to Dashboard
            </a>
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            — The EyesWide Team
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }
}

export async function sendCampaignNotification(
  email: string,
  creatorName: string,
  brandName: string,
  campaignTitle: string,
  type: "new_campaign" | "campaign_accepted" | "campaign_rejected" | "campaign_completed"
) {
  const subjects = {
    new_campaign: `New PR package offer from ${brandName}`,
    campaign_accepted: `${creatorName} accepted your campaign "${campaignTitle}"`,
    campaign_rejected: `${creatorName} declined your campaign "${campaignTitle}"`,
    campaign_completed: `Campaign "${campaignTitle}" has been completed`,
  };

  const bodies = {
    new_campaign: `
      <p>${brandName} wants to send you a PR package!</p>
      <p><strong>Campaign:</strong> ${campaignTitle}</p>
      <p>Log in to view the details and respond.</p>
    `,
    campaign_accepted: `
      <p>Great news! ${creatorName} has accepted your PR package campaign.</p>
      <p><strong>Campaign:</strong> ${campaignTitle}</p>
      <p>You can now start coordinating the details.</p>
    `,
    campaign_rejected: `
      <p>${creatorName} has declined your campaign offer.</p>
      <p><strong>Campaign:</strong> ${campaignTitle}</p>
      <p>Don't worry — there are plenty of other creators to connect with.</p>
    `,
    campaign_completed: `
      <p>The campaign "${campaignTitle}" has been marked as completed.</p>
      <p>Thank you for using EyesWide!</p>
    `,
  };

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: subjects[type],
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #111;">${subjects[type]}</h2>
          ${bodies[type]}
          <p style="margin-top: 20px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/campaigns"
               style="background-color: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Campaign
            </a>
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            — The EyesWide Team
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send campaign notification:", error);
  }
}

export async function sendMessageNotification(
  email: string,
  senderName: string,
  campaignTitle: string,
  messagePreview: string
) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `New message from ${senderName} on "${campaignTitle}"`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #111;">New message from ${senderName}</h2>
          <p><strong>Campaign:</strong> ${campaignTitle}</p>
          <div style="background-color: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; color: #333;">${messagePreview}</p>
          </div>
          <p style="margin-top: 20px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/campaigns"
               style="background-color: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reply
            </a>
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            — The EyesWide Team
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send message notification:", error);
  }
}

export async function sendTrialEndingEmail(email: string, brandName: string, daysLeft: number) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Your EyesWide trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #111;">Your trial is ending soon</h2>
          <p>Hi ${brandName},</p>
          <p>Your EyesWide free trial ends in <strong>${daysLeft} day${daysLeft !== 1 ? "s" : ""}</strong>.</p>
          <p>To keep accessing creators and managing your campaigns, add your billing information now.</p>
          <p style="margin-top: 20px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/billing"
               style="background-color: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Add Billing
            </a>
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            — The EyesWide Team
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send trial ending email:", error);
  }
}
