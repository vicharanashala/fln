import { Certification } from '../models/certification.model';
import { ICertificationDocument } from '../interfaces/certification.interface';

/**
 * Read-only this phase. The new backend has no evaluation-creation flow,
 * so there's nothing to trigger certification upserts from here yet.
 *
 * Once the legacy backend's evaluation handlers migrate over, this repo
 * gains `upsertByStudentAndClass(studentId, classNumber, level, decision)`
 * and the certification service orchestration can be uncommented.
 */
export class CertificationRepository {
  async findByStudent(studentId: string): Promise<ICertificationDocument[]> {
    return Certification.find({ studentId }).sort({ updatedAt: -1 }).exec();
  }

  async findByStudentAndClass(
    studentId: string,
    classNumber: number,
    level: number
  ): Promise<ICertificationDocument | null> {
    return Certification.findOne({ studentId, classNumber, level }).exec();
  }

  async findActiveByStudent(
    studentId: string
  ): Promise<ICertificationDocument[]> {
    return Certification.find({ studentId, status: 'active' }).exec();
  }
}