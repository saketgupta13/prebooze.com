import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../notifications/email';

@Injectable()
export class CareersService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async jobs() {
    return this.prisma.careerJob.findMany({ where: { status: 'open' }, orderBy: { createdAt: 'asc' } });
  }

  /** Public — no login required, matches the frontend's Careers.tsx form
   * (plain name/email/phone fields, not tied to a logged-in user). */
  async apply(body: { jobId?: string; name?: string; email?: string; phone?: string; note?: string; cv?: string }) {
    if (!body.jobId) throw new BadRequestException('jobId is required');
    if (!body.name?.trim() || !body.email?.trim() || !body.phone?.trim()) {
      throw new BadRequestException('name, email and phone are required');
    }
    const job = await this.prisma.careerJob.findUnique({ where: { id: body.jobId } });
    if (!job) throw new NotFoundException('Unknown job');

    const application = await this.prisma.jobApplication.create({
      data: {
        jobId: body.jobId,
        name: body.name.trim(),
        email: body.email.trim(),
        phone: body.phone.trim(),
        note: body.note?.trim() ?? '',
        cv: body.cv,
      },
    });

    await this.email.sendTemplate(application.email, 'job_application', {
      name: application.name, jobTitle: job.title,
    }).catch(() => {});

    return application;
  }
}
