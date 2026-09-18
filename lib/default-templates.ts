import type { TemplateCategory } from "@/models/MessageTemplate";

export const DEFAULT_TEMPLATES: { category: TemplateCategory; title: string; body: string }[] = [
  {
    category: "Introduction",
    title: "Introduction Message",
    body:
      "Hi {{client_name}}! This is {{vaishnavi_name}} 🎤 Thank you for reaching out. I'd love to learn more about your {{event_type}} on {{event_date}} — could you share a few details about the event and audience?",
  },
  {
    category: "Quotation",
    title: "Event Quotation",
    body:
      "Hi {{client_name}}, here are the details for your {{event_name}} on {{event_date}} at {{venue}}:\n\nFee: {{fee}}\nAdvance to confirm: {{advance_amount}}\n\nLet me know if you'd like to proceed and I'll block the date for you!",
  },
  {
    category: "Booking Confirmation",
    title: "Booking Confirmation",
    body:
      "Hi {{client_name}}! Your {{event_type}} on {{event_date}} at {{event_time}} ({{venue}}) is now confirmed with {{vaishnavi_name}} 🎉 Looking forward to making it memorable!",
  },
  {
    category: "Availability Reply",
    title: "Availability Reply",
    body:
      "Hi {{client_name}}, thanks for checking! {{event_date}} ({{event_time}}) is currently open on my calendar. Shall I go ahead and share a quotation for your {{event_type}}?",
  },
  {
    category: "Payment Reminder",
    title: "Payment Reminder",
    body:
      "Hi {{client_name}}, just a gentle reminder about the pending payment for {{event_name}} on {{event_date}}. Balance due: {{fee}}. Thank you so much!",
  },
  {
    category: "Event Details Request",
    title: "Event Details Request",
    body:
      "Hi {{client_name}}, to help me prepare for {{event_name}} on {{event_date}}, could you share the run-of-show, venue address ({{venue}}), and any special requests?",
  },
  {
    category: "Thank You",
    title: "Thank You Message",
    body:
      "Hi {{client_name}}, thank you so much for having me host {{event_name}}! It was truly a pleasure being part of your special day. Wishing you all the best 💛",
  },
  {
    category: "Collaboration",
    title: "Collaboration Message",
    body:
      "Hi! This is {{vaishnavi_name}}, an event anchor and host. I'd love to explore a collaboration opportunity for {{event_type}} events. Let me know if you'd like to connect!",
  },
  {
    category: "Follow-up",
    title: "Follow-up Message",
    body:
      "Hi {{client_name}}, just following up on {{event_name}} — would you like me to go ahead and block {{event_date}} for you?",
  },
];
