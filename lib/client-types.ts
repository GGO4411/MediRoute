export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export interface ClientUser {
 userId: number;
 name: string;
 role: UserRole;
}

export interface ClientDoctor {
 doctor_id: number;
 doctor_name: string;
 email?: string;
 specialty: string;
 qualification: string;
 years_experience: number;
 consultation_fee: number;
 bio?: string | null;
 is_accepting_patients?: boolean;
}

export interface ClientAppointmentHistoryEvent {
 action: string;
 changed_at: string;
 old_status?: string | null;
 new_status?: string | null;
 cancellation_reason?: string | null;
 old_starts_at?: string | null;
 new_starts_at?: string | null;
}

export interface ClientAppointment {
 appointment_id: number;
 patient_id?: number;
 patient_name?: string;
 doctor_id: number;
 doctor_name: string;
 specialty: string;
 starts_at: string;
 status: string;
 cancellation_reason?: string | null;
 urgency: string;
 history?: ClientAppointmentHistoryEvent[];
}

export interface ClientSlot {
 slotId: number;
 doctorId?: number;
 doctorName?: string;
 startsAt: string;
 endsAt: string;
}

export interface ClientPrescription {
 prescriptionId: number;
 appointmentId?: number;
 patientId: number;
 medicationName: string;
 dosage?: string | null;
 doctorName: string;
 prescribedAt: string;
 instructions?: string | null;
 diagnosisNotes?: string | null;
}

export interface ClientCorpusEntry {
 id: string;
 condition: string;
 description?: string;
 specialty: string;
 source?: string;
}

export interface ClientSemanticMatch {
 id: string | number;
 score: number;
 condition?: string;
 description?: string;
 specialty?: string;
}

export interface ClientTriageResult {
 triageId: number;
 urgency: 'ROUTINE' | 'SOON' | 'URGENT' | 'EMERGENCY';
 urgencyScore: number;
 flags: string[];
 emergencyMessage: string | null;
 routingSkipped: boolean;
 lowConfidence: boolean;
 vectorAvailable: boolean;
 disclaimer: string;
 matches: ClientSemanticMatch[];
 doctors: ClientDoctor[];
}

export function errorMessage(error: unknown, fallback: string): string {
 return error instanceof Error ? error.message : fallback;
}
