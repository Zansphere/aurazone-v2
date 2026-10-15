"use client";

import { useState } from "react";
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2, MessageSquare } from "lucide-react";

export default function ContactUsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate sending inquiry / dispatching notification
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setName("");
      setEmail("");
      setSubject("");
      setOrderNumber("");
      setMessage("");
    }, 1000);
  };

  return (
    <div className="section-container py-10 max-w-5xl">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-3xl font-extrabold text-[var(--color-text-primary)]">Contact Support</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Have a question about your order, return, or need help? Our support team is here to assist
          you 6 days a week.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Support Channels Info */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Mail size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Email Us</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                For order support, refunds, or general queries
              </p>
              <a
                href="mailto:support@aurazone.in"
                className="text-xs font-semibold text-[var(--color-accent)] hover:underline mt-2 inline-block"
              >
                support@aurazone.in
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <Phone size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Customer Helpline</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Toll-free customer assistance
              </p>
              <p className="text-xs font-semibold text-[var(--color-accent)] mt-2">
                1800-209-AURA (2872)
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Operational Hours</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Monday to Saturday: 9:00 AM – 8:00 PM IST
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">Sunday: Closed</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Headquarters</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                AuraZone Technologies Pvt. Ltd.
                <br />
                Indiranagar, Bangalore, Karnataka 560038
              </p>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="md:col-span-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <MessageSquare size={20} className="text-[var(--color-accent)]" />
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Send Us a Message</h2>
          </div>

          {submitted ? (
            <div className="py-12 text-center space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Message Received!</h3>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
                Thank you for reaching out. A support ticket has been created and our team will get
                back to you within 24 business hours.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
                    Subject *
                  </label>
                  <select
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
                  >
                    <option value="">Select a topic</option>
                    <option value="order">Order Tracking & Delivery</option>
                    <option value="refund">Returns & Refunds</option>
                    <option value="product">Product Inquiries</option>
                    <option value="payment">Payment & Invoice Issue</option>
                    <option value="vendor">Vendor / Seller Support</option>
                    <option value="other">General Inquiry</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
                    Order Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="e.g. ORD-17382910"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
                  Your Message *
                </label>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we assist you today? Please provide details such as order number or tracking token if applicable..."
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-3.5 text-sm outline-none resize-none focus:border-[var(--color-accent)] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all shadow-md disabled:opacity-50"
              >
                {submitting ? "Sending..." : "Submit Inquiry"} <Send size={14} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
