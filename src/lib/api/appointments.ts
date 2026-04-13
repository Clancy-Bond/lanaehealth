import { supabase } from '@/lib/supabase'
import type { Appointment, Document } from '@/lib/types'

/**
 * Get all appointments, most recent first
 */
export async function getAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .order('date', { ascending: false })

  if (error) throw new Error(`Failed to fetch appointments: ${error.message}`)
  return (data || []) as Appointment[]
}

/**
 * Add an appointment
 */
export async function addAppointment(
  input: Omit<Appointment, 'id' | 'created_at'>
): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`Failed to add appointment: ${error.message}`)
  return data as Appointment
}

/**
 * Update an appointment
 */
export async function updateAppointment(
  id: string,
  fields: Partial<Omit<Appointment, 'id' | 'created_at'>>
): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .update(fields)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update appointment: ${error.message}`)
  return data as Appointment
}

/**
 * Delete an appointment
 */
export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete appointment: ${error.message}`)
}

/**
 * Get documents for an appointment
 */
export async function getDocuments(appointmentId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('appointment_id', appointmentId)
    .order('uploaded_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`)
  return (data || []) as Document[]
}

/**
 * Upload a document to Supabase Storage and create a record
 */
export async function uploadDocument(
  appointmentId: string,
  file: File
): Promise<Document> {
  const fileName = `${Date.now()}_${file.name}`
  const filePath = `documents/${appointmentId}/${fileName}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('endotracker-docs')
    .upload(filePath, file)

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  // Create document record
  const { data, error } = await supabase
    .from('documents')
    .insert({
      appointment_id: appointmentId,
      file_name: file.name,
      file_path: filePath,
      file_type: file.type || null,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create document record: ${error.message}`)
  return data as Document
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string, filePath: string): Promise<void> {
  // Delete from storage
  await supabase.storage.from('endotracker-docs').remove([filePath])

  // Delete record
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Failed to delete document: ${error.message}`)
}

/**
 * Get a public URL for a document
 */
export function getDocumentUrl(filePath: string): string {
  const { data } = supabase.storage.from('endotracker-docs').getPublicUrl(filePath)
  return data.publicUrl
}
