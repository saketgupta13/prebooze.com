/** Same contract as prebooze-web/src/api/index.ts's `kyc` export — organizer
 * verification lives in the KYC module (kyc.controller.ts), not the
 * organizer module. */
import { apiUpload, apiFetch } from './client';
import type { KycSubmission } from '../types';

export const kyc = {
  myStatus: () => apiFetch<KycSubmission[]>('/kyc/me'),
  submitOrganizerVerification: async (
    payload: {
      entityType: 'individual' | 'firm';
      contactName: string;
      contactPhone: string;
      contactEmail: string;
      contactRole: string;
      contactRoleOther?: string;
      docLabels: string[];
      // Resubmitting after a rejection — carries forward whichever
      // required documents weren't freshly re-uploaded this time (server
      // copies them from this submission's own stored files, no re-upload
      // needed). Omit on a first-time submission.
      previousSubmissionId?: string;
    },
    docs: { uri: string; name: string; mimeType: string }[],
  ) => {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    // Same Blob-fix as organizer.upload() — Expo's global fetch/FormData
    // only accepts a real Blob, not RN's classic {uri,name,type} shorthand.
    for (const d of docs) {
      const blob = await fetch(d.uri).then((r) => r.blob());
      form.append('documents', blob, d.name);
    }
    return apiUpload<{ id: string; status: string }>('/kyc/organizer/verification', form);
  },
};
