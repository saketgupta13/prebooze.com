import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async list(organizerId?: string) {
    // organizerId is a loose reference here (no FK relation declared on
    // OrgReview, same pattern as PromoterGuest.promoterSlug) — batch-fetch
    // and merge in JS rather than adding a relation just for this read.
    const reviews = await this.prisma.orgReview.findMany({
      where: organizerId ? { organizerId } : undefined,
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const organizers = await this.prisma.organizer.findMany({
      where: { id: { in: [...new Set(reviews.map((r) => r.organizerId))] } },
      select: { id: true, brandName: true },
    });
    const nameById = new Map(organizers.map((o) => [o.id, o.brandName]));
    return reviews.map((r) => ({ ...r, organizerName: nameById.get(r.organizerId) ?? r.organizerId }));
  }

  async update(id: string, body: { rating?: number; text?: string }) {
    const review = await this.prisma.orgReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (body.rating !== undefined && (body.rating < 1 || body.rating > 5)) throw new BadRequestException('rating must be 1-5');
    return this.prisma.orgReview.update({
      where: { id },
      data: { rating: body.rating, text: body.text?.trim() },
    });
  }

  async remove(id: string) {
    const review = await this.prisma.orgReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.orgReview.delete({ where: { id } });
    return { ok: true };
  }
}
