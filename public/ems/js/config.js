/* config.js — BCCL EMS runtime configuration (no secrets). */
window.BCCL = window.BCCL || {};
window.BCCL.CONFIG = {
  // Permanent development admin. Provision this account once via Sign Up on the
  // Employee tab; a database trigger auto-grants the admin role for this email.
  ADMIN_EMAIL: "admin@bccl.com",
  DEFAULT_ADMIN_PASSWORD: "admin123", // dev only — remove for production
  BUCKET_PHOTOS: "employee-photos",
  BUCKET_DOCS:   "employee-photos", // reused; PAN/Aadhaar stored under user-id/pan|aadhaar/*
  BUCKET_FORM16: "form16-documents",
};
