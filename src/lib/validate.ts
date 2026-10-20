import type { Profile } from "./types";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readProfile(body: Record<string, unknown>): Profile | string {
  const profile: Profile = {
    firstName: clean(body.firstName),
    lastName: clean(body.lastName),
    email: clean(body.email).toLowerCase(),
    phone: clean(body.phone),
    company: clean(body.company),
    designation: clean(body.designation),
  };

  if (!profile.firstName || profile.firstName.length > 80) return "First name is required.";
  if (!profile.lastName || profile.lastName.length > 80) return "Last name is required.";
  if (!profile.email || !EMAIL_PATTERN.test(profile.email) || profile.email.length > 120) {
    return "A valid email address is required.";
  }
  if (!profile.phone || profile.phone.length > 40) return "Phone number is required.";
  if (!profile.company || profile.company.length > 120) return "Company is required.";
  if (!profile.designation || profile.designation.length > 120) {
    return "Designation is required.";
  }
  return profile;
}

export { clean };
