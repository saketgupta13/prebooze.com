import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CmsService {
  constructor(private prisma: PrismaService) {}

  // ---------- banners ----------
  async listBanners() {
    return this.prisma.banner.findMany({ orderBy: { sort: 'asc' } });
  }
  async createBanner(body: Record<string, unknown>) {
    if (!body.title) throw new BadRequestException('title is required');
    return this.prisma.banner.create({ data: body as never });
  }
  async updateBanner(id: string, patch: Record<string, unknown>) {
    if (!(await this.prisma.banner.findUnique({ where: { id } }))) throw new NotFoundException('Banner not found');
    return this.prisma.banner.update({ where: { id }, data: omit(patch, ['id']) as never });
  }
  async removeBanner(id: string) {
    if (!(await this.prisma.banner.findUnique({ where: { id } }))) throw new NotFoundException('Banner not found');
    await this.prisma.banner.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- blog categories ----------
  async listBlogCategories() {
    return this.prisma.blogCategory.findMany({ orderBy: { name: 'asc' } });
  }
  async createBlogCategory(body: { name?: string; bannerUrl?: string; seo?: unknown }) {
    if (!body.name?.trim()) throw new BadRequestException('name is required');
    if (await this.prisma.blogCategory.findUnique({ where: { name: body.name } })) throw new BadRequestException('Category already exists');
    return this.prisma.blogCategory.create({ data: { name: body.name.trim(), bannerUrl: body.bannerUrl, seo: body.seo as never } });
  }
  async removeBlogCategory(id: string) {
    if (!(await this.prisma.blogCategory.findUnique({ where: { id } }))) throw new NotFoundException('Category not found');
    await this.prisma.blogCategory.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- blogs ----------
  async listBlogs() {
    return this.prisma.blog.findMany({ orderBy: { updatedAt: 'desc' } });
  }
  async createBlog(body: Record<string, unknown>) {
    if (!body.title) throw new BadRequestException('title is required');
    return this.prisma.blog.create({ data: { status: 'draft', meta: '', ...body } as never });
  }
  async updateBlog(id: string, patch: Record<string, unknown>) {
    if (!(await this.prisma.blog.findUnique({ where: { id } }))) throw new NotFoundException('Blog not found');
    return this.prisma.blog.update({ where: { id }, data: omit(patch, ['id']) as never });
  }
  async removeBlog(id: string) {
    if (!(await this.prisma.blog.findUnique({ where: { id } }))) throw new NotFoundException('Blog not found');
    await this.prisma.blog.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- pages ----------
  async listPages() {
    return this.prisma.sitePage.findMany({ orderBy: { title: 'asc' } });
  }
  async createPage(body: { slug?: string; title?: string; content?: string; navGroup?: string; seo?: unknown }) {
    if (!body.slug?.trim() || !body.title?.trim()) throw new BadRequestException('slug and title are required');
    if (await this.prisma.sitePage.findUnique({ where: { slug: body.slug } })) throw new BadRequestException('A page with this slug already exists');
    return this.prisma.sitePage.create({ data: { slug: body.slug.trim(), title: body.title.trim(), content: body.content, navGroup: body.navGroup, seo: body.seo as never } });
  }
  async updatePage(slug: string, patch: Record<string, unknown>) {
    if (!(await this.prisma.sitePage.findUnique({ where: { slug } }))) throw new NotFoundException('Page not found');
    return this.prisma.sitePage.update({ where: { slug }, data: omit(patch, ['slug']) as never });
  }
  async removePage(slug: string) {
    if (!(await this.prisma.sitePage.findUnique({ where: { slug } }))) throw new NotFoundException('Page not found');
    await this.prisma.sitePage.delete({ where: { slug } });
    return { ok: true };
  }

  // ---------- testimonials ----------
  async listTestimonials() {
    return this.prisma.testimonial.findMany({ orderBy: { createdAt: 'desc' } });
  }
  async createTestimonial(body: Record<string, unknown>) {
    if (!body.author || !body.quote) throw new BadRequestException('author and quote are required');
    return this.prisma.testimonial.create({ data: { location: '', rating: 5, featured: false, ...body } as never });
  }
  async updateTestimonial(id: string, patch: Record<string, unknown>) {
    if (!(await this.prisma.testimonial.findUnique({ where: { id } }))) throw new NotFoundException('Testimonial not found');
    return this.prisma.testimonial.update({ where: { id }, data: omit(patch, ['id']) as never });
  }
  async removeTestimonial(id: string) {
    if (!(await this.prisma.testimonial.findUnique({ where: { id } }))) throw new NotFoundException('Testimonial not found');
    await this.prisma.testimonial.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- faqs ----------
  async listFaqs() {
    return this.prisma.faqItem.findMany({ orderBy: { sort: 'asc' } });
  }
  async createFaq(body: { question?: string; answer?: string; audience?: 'guests' | 'organizers'; sort?: number }) {
    if (!body.question?.trim() || !body.answer?.trim()) throw new BadRequestException('question and answer are required');
    return this.prisma.faqItem.create({ data: { question: body.question.trim(), answer: body.answer.trim(), audience: body.audience ?? 'guests', sort: body.sort ?? 0 } });
  }
  async updateFaq(id: string, patch: Record<string, unknown>) {
    if (!(await this.prisma.faqItem.findUnique({ where: { id } }))) throw new NotFoundException('FAQ not found');
    return this.prisma.faqItem.update({ where: { id }, data: omit(patch, ['id']) as never });
  }
  async removeFaq(id: string) {
    if (!(await this.prisma.faqItem.findUnique({ where: { id } }))) throw new NotFoundException('FAQ not found');
    await this.prisma.faqItem.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- policies ----------
  async listPolicies() {
    return this.prisma.policy.findMany({ orderBy: { title: 'asc' } });
  }
  async createPolicy(body: { title?: string; slug?: string; sections?: unknown; seo?: unknown }) {
    if (!body.title?.trim() || !body.slug?.trim()) throw new BadRequestException('title and slug are required');
    if (await this.prisma.policy.findUnique({ where: { slug: body.slug } })) throw new BadRequestException('A policy with this slug already exists');
    return this.prisma.policy.create({ data: { title: body.title.trim(), slug: body.slug.trim(), sections: (body.sections ?? []) as never, seo: body.seo as never } });
  }
  async updatePolicy(id: string, patch: Record<string, unknown>) {
    if (!(await this.prisma.policy.findUnique({ where: { id } }))) throw new NotFoundException('Policy not found');
    return this.prisma.policy.update({ where: { id }, data: omit(patch, ['id', 'slug']) as never });
  }
  async removePolicy(id: string) {
    if (!(await this.prisma.policy.findUnique({ where: { id } }))) throw new NotFoundException('Policy not found');
    await this.prisma.policy.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- menu config (singleton) ----------
  async getMenu() {
    return (await this.prisma.menuConfig.findUnique({ where: { id: 'main' } })) ?? this.prisma.menuConfig.create({ data: { id: 'main', header: [], footer: [] } });
  }
  async updateMenu(body: { header?: unknown; footer?: unknown }) {
    return this.prisma.menuConfig.upsert({
      where: { id: 'main' },
      create: { id: 'main', header: (body.header ?? []) as never, footer: (body.footer ?? []) as never },
      update: { header: body.header as never, footer: body.footer as never },
    });
  }
}

function omit(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}
