import { FilterQuery } from 'mongoose';
import { Student } from '../models/student.model';
import { IStudent, IStudentDocument } from '../interfaces/student.interface';

/**
 * Repository for the seeded `students` collection.
 *
 * The collection is read-write in this codebase (we insert newly-registered
 * students on POST and read them on GET), so this repository exposes
 * `create` + filtered `findAll`. No update/delete methods are exposed yet —
 * those would be Phase 2 surface area.
 *
 * All filters are by business-ID string fields, mirroring the Class
 * repository's business-ID conventions.
 */
export class StudentRepository {
  /**
   * List students matching the given filter (e.g. `{ classGroup, section,
   * schoolId }`). Returns plain JS objects (`.lean()`) — no Mongoose
   * document wrappers — so the controller can JSON-serialize them directly
   * with no `$__` / `_doc` bloat. The controller is responsible for any
   * role-based response shaping (aadhar masking, school-scope filtering).
   */
  async findAll(filter?: FilterQuery<IStudentDocument>): Promise<IStudent[]> {
    return Student.find(filter || {}).sort({ name: 1 }).lean().exec() as unknown as Promise<IStudent[]>;
  }

  /**
   * Insert a new student. The caller is responsible for populating `id`,
   * `currentLevel`, etc. before calling — this method is a thin wrapper
   * around `Student.create()`. Returns a plain JS object via the schema's
   * `toJSON` transform (which strips `__v` and lets the controller
   * JSON-serialize the response directly). Mongoose's `_id` is preserved
   * on the wire — same behaviour as the legacy `index.ts` POST handler
   * (line 473) which echoes the freshly inserted Mongo document verbatim.
   */
  async create(data: IStudent): Promise<IStudent> {
    const created = await Student.create(data);
    return created.toJSON() as IStudent;
  }

  /**
   * Returns true if any student document already has `aadharMasked` equal
   * to the supplied raw digits. Mirrors the legacy `index.ts` duplicate-
   * detection logic (line 437) so the same uniqueness invariant holds.
   */
  async existsByAadhar(rawAadhar: string): Promise<boolean> {
    const count = await Student.countDocuments({ aadharMasked: rawAadhar }).exec();
    return count > 0;
  }

  /**
   * Look up a single student by its business `id` string (e.g.
   * `"s_AP_GNT_GNT_01_01_C2_01"`). Returns `null` when no matching
   * document exists; the service layer is responsible for turning that
   * into a 404. Returns a lean JS object so the controller can pipe it
   * straight to the wire with no Mongoose bloat, matching
   * `findAll`/`create` conventions.
   *
   * Mirrors the Class module's business-ID conventions: no `_id` cast,
   * no numeric coercion. The seeded `students` collection indexes `id`
   * implicitly via the `unique: true` constraint on the schema.
   */
  async findById(id: string): Promise<IStudent | null> {
    const doc = await Student.findOne({ id }).lean().exec();
    return (doc as unknown as IStudent) ?? null;
  }

  /**
   * Patch a student document identified by its business `id`. The
   * `patch` object is forwarded straight into Mongoose `$set` so the
   * service / controller can pass only the fields the user actually
   * edited (no full-document replacement).
   *
   * Returns the updated document as a plain JS object (no Mongoose
   * wrappers) so the controller can JSON-serialize it directly. The
   * schema's `toJSON` transform strips `__v` so the response shape
   * matches `findAll` / `create` conventions.
   *
   * Returns `null` when no student matches the supplied id; the service
   * layer is responsible for mapping that to a 404.
   *
   * `runValidators: true` is left at its default-off because the seeded
   * `students` collection predates the new optional fields and many
   * seeded docs have legacy nulls that Mongoose's strict validators
   * would reject. The service-layer validation is the single source of
   * truth for input shape — the repository is a thin wrapper.
   */
  async updateById(
    id: string,
    patch: Partial<IStudent>
  ): Promise<IStudent | null> {
    const updated = await Student.findOneAndUpdate(
      { id },
      { $set: patch },
      { new: true }
    )
      .lean()
      .exec();
    return (updated as unknown as IStudent) ?? null;
  }
}