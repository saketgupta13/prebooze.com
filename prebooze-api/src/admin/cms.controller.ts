import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CmsService } from './cms.service';
import { StaffAuthGuard } from './staff-auth.guard';
import { PermissionGuard } from './permission.guard';
import { RequirePermission } from './permission.decorator';

const MODULE = 'Content (banners / blogs / pages)';

@Controller('admin')
@UseGuards(StaffAuthGuard, PermissionGuard)
export class AdminCmsController {
  constructor(private cms: CmsService) {}

  // ---- banners ----
  @Get('banners')
  @RequirePermission(MODULE, 'view')
  listBanners() {
    return this.cms.listBanners();
  }
  @Post('banners')
  @RequirePermission(MODULE, 'edit')
  createBanner(@Body() body: Record<string, unknown>) {
    return this.cms.createBanner(body);
  }
  @Patch('banners/:id')
  @RequirePermission(MODULE, 'edit')
  updateBanner(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cms.updateBanner(id, body);
  }
  @Delete('banners/:id')
  @RequirePermission(MODULE, 'edit')
  removeBanner(@Param('id') id: string) {
    return this.cms.removeBanner(id);
  }

  // ---- blog categories ----
  @Get('blog-categories')
  @RequirePermission(MODULE, 'view')
  listBlogCategories() {
    return this.cms.listBlogCategories();
  }
  @Post('blog-categories')
  @RequirePermission(MODULE, 'edit')
  createBlogCategory(@Body() body: Parameters<CmsService['createBlogCategory']>[0]) {
    return this.cms.createBlogCategory(body);
  }
  @Delete('blog-categories/:id')
  @RequirePermission(MODULE, 'edit')
  removeBlogCategory(@Param('id') id: string) {
    return this.cms.removeBlogCategory(id);
  }

  // ---- blogs ----
  @Get('blogs')
  @RequirePermission(MODULE, 'view')
  listBlogs() {
    return this.cms.listBlogs();
  }
  @Post('blogs')
  @RequirePermission(MODULE, 'edit')
  createBlog(@Body() body: Record<string, unknown>) {
    return this.cms.createBlog(body);
  }
  @Patch('blogs/:id')
  @RequirePermission(MODULE, 'edit')
  updateBlog(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cms.updateBlog(id, body);
  }
  @Delete('blogs/:id')
  @RequirePermission(MODULE, 'edit')
  removeBlog(@Param('id') id: string) {
    return this.cms.removeBlog(id);
  }

  // ---- pages ----
  @Get('pages')
  @RequirePermission(MODULE, 'view')
  listPages() {
    return this.cms.listPages();
  }
  @Post('pages')
  @RequirePermission(MODULE, 'edit')
  createPage(@Body() body: Parameters<CmsService['createPage']>[0]) {
    return this.cms.createPage(body);
  }
  @Patch('pages/:slug')
  @RequirePermission(MODULE, 'edit')
  updatePage(@Param('slug') slug: string, @Body() body: Record<string, unknown>) {
    return this.cms.updatePage(decodeURIComponent(slug), body);
  }
  @Delete('pages/:slug')
  @RequirePermission(MODULE, 'edit')
  removePage(@Param('slug') slug: string) {
    return this.cms.removePage(decodeURIComponent(slug));
  }

  // ---- testimonials ----
  @Get('testimonials')
  @RequirePermission(MODULE, 'view')
  listTestimonials() {
    return this.cms.listTestimonials();
  }
  @Post('testimonials')
  @RequirePermission(MODULE, 'edit')
  createTestimonial(@Body() body: Record<string, unknown>) {
    return this.cms.createTestimonial(body);
  }
  @Patch('testimonials/:id')
  @RequirePermission(MODULE, 'edit')
  updateTestimonial(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cms.updateTestimonial(id, body);
  }
  @Delete('testimonials/:id')
  @RequirePermission(MODULE, 'edit')
  removeTestimonial(@Param('id') id: string) {
    return this.cms.removeTestimonial(id);
  }

  // ---- faqs ----
  @Get('faqs')
  @RequirePermission(MODULE, 'view')
  listFaqs() {
    return this.cms.listFaqs();
  }
  @Post('faqs')
  @RequirePermission(MODULE, 'edit')
  createFaq(@Body() body: Parameters<CmsService['createFaq']>[0]) {
    return this.cms.createFaq(body);
  }
  @Patch('faqs/:id')
  @RequirePermission(MODULE, 'edit')
  updateFaq(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cms.updateFaq(id, body);
  }
  @Delete('faqs/:id')
  @RequirePermission(MODULE, 'edit')
  removeFaq(@Param('id') id: string) {
    return this.cms.removeFaq(id);
  }

  // ---- policies ----
  @Get('policies')
  @RequirePermission(MODULE, 'view')
  listPolicies() {
    return this.cms.listPolicies();
  }
  @Post('policies')
  @RequirePermission(MODULE, 'edit')
  createPolicy(@Body() body: Parameters<CmsService['createPolicy']>[0]) {
    return this.cms.createPolicy(body);
  }
  @Patch('policies/:id')
  @RequirePermission(MODULE, 'edit')
  updatePolicy(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cms.updatePolicy(id, body);
  }
  @Delete('policies/:id')
  @RequirePermission(MODULE, 'edit')
  removePolicy(@Param('id') id: string) {
    return this.cms.removePolicy(id);
  }

  // ---- menu (singleton) ----
  @Get('menu')
  @RequirePermission(MODULE, 'view')
  getMenu() {
    return this.cms.getMenu();
  }
  @Patch('menu')
  @RequirePermission(MODULE, 'edit')
  updateMenu(@Body() body: Parameters<CmsService['updateMenu']>[0]) {
    return this.cms.updateMenu(body);
  }
}
