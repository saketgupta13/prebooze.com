import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CareersAdminService {
  constructor(private prisma: PrismaService) {}

  // ---------- jobs ----------
  async listJobs() {
    return this.prisma.careerJob.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createJob(body: { title?: string; team?: string; loc?: string; type?: string; about?: string; responsibilities?: string[]; requirements?: string[] }) {
    if (!body.title?.trim()) throw new BadRequestException('title is required');
    return this.prisma.careerJob.create({
      data: {
        title: body.title.trim(),
        team: body.team ?? '',
        loc: body.loc ?? '',
        type: body.type ?? 'Full-time',
        about: body.about ?? '',
        responsibilities: body.responsibilities ?? [],
        requirements: body.requirements ?? [],
      },
    });
  }

  async updateJob(id: string, patch: Record<string, unknown>) {
    if (!(await this.prisma.careerJob.findUnique({ where: { id } }))) throw new NotFoundException('Job not found');
    return this.prisma.careerJob.update({ where: { id }, data: omit(patch, ['id']) as never });
  }

  async toggleJob(id: string) {
    const job = await this.prisma.careerJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    return this.prisma.careerJob.update({ where: { id }, data: { status: job.status === 'open' ? 'closed' : 'open' } });
  }

  async removeJob(id: string) {
    if (!(await this.prisma.careerJob.findUnique({ where: { id } }))) throw new NotFoundException('Job not found');
    // applicant records have real value (a candidate's contact info/resume
    // reference) — never silently destroy them by cascading; close the job
    // instead (toggleJob) if it has applicants.
    const applicantCount = await this.prisma.jobApplication.count({ where: { jobId: id } });
    if (applicantCount > 0) throw new BadRequestException(`This job has ${applicantCount} applicant(s) — close it instead of removing it`);
    await this.prisma.careerJob.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- applicants ----------
  async listApplicants(jobId?: string) {
    return this.prisma.jobApplication.findMany({ where: jobId ? { jobId } : undefined, orderBy: { appliedAt: 'desc' } });
  }

  // ---------- teams (reference list for the job-creation form) ----------
  async listTeams() {
    return this.prisma.careerTeam.findMany({ orderBy: { name: 'asc' } });
  }

  async addTeam(name: string) {
    if (!name?.trim()) throw new BadRequestException('name is required');
    const existing = await this.prisma.careerTeam.findUnique({ where: { name: name.trim() } });
    if (existing) return existing;
    return this.prisma.careerTeam.create({ data: { name: name.trim() } });
  }
}

function omit(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}
