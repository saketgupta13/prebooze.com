import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

type AuthedReq = { user: { sub: string } };

@Controller()
export class SocialController {
  constructor(private social: SocialService) {}

  @Post('follows')
  @UseGuards(JwtAuthGuard)
  follow(@Req() req: AuthedReq, @Body('key') key: string) {
    return this.social.follow(req.user.sub, key);
  }

  @Delete('follows')
  @UseGuards(JwtAuthGuard)
  unfollow(@Req() req: AuthedReq, @Body('key') key: string) {
    return this.social.unfollow(req.user.sub, key);
  }

  @Get('me/followers')
  @UseGuards(JwtAuthGuard)
  followers(@Req() req: AuthedReq) {
    return this.social.followers(req.user.sub);
  }

  @Get('me/follow-requests')
  @UseGuards(JwtAuthGuard)
  followRequests(@Req() req: AuthedReq) {
    return this.social.followRequests(req.user.sub);
  }

  @Post('me/follow-requests/:personId')
  @UseGuards(JwtAuthGuard)
  respondFollowRequest(@Req() req: AuthedReq, @Param('personId') personId: string, @Body('accept') accept: boolean) {
    return this.social.respondFollowRequest(req.user.sub, personId, accept);
  }

  @Post('me/attendance-visibility')
  @UseGuards(JwtAuthGuard)
  attendanceVisibility(@Req() req: AuthedReq, @Body('v') v: string) {
    return this.social.setAttendanceVisibility(req.user.sub, v);
  }

  @Post('me/discoverable')
  @UseGuards(JwtAuthGuard)
  discoverable(@Req() req: AuthedReq, @Body('on') on: boolean) {
    return this.social.setDiscoverable(req.user.sub, on);
  }

  @Post('me/marketing-consent')
  @UseGuards(JwtAuthGuard)
  marketingConsent(@Req() req: AuthedReq, @Body('on') on: boolean) {
    return this.social.setMarketingConsent(req.user.sub, on);
  }

  @Get('me/social')
  @UseGuards(JwtAuthGuard)
  mySocialState(@Req() req: AuthedReq) {
    return this.social.mySocialState(req.user.sub);
  }

  @Post('events/:id/interested')
  @UseGuards(JwtAuthGuard)
  interested(@Req() req: AuthedReq, @Param('id') id: string, @Body('on') on: boolean) {
    return this.social.setInterested(req.user.sub, id, on);
  }

  @Post('events/:id/wishlist')
  @UseGuards(JwtAuthGuard)
  wishlist(@Req() req: AuthedReq, @Param('id') id: string, @Body('on') on: boolean) {
    return this.social.setWishlist(req.user.sub, id, on);
  }

  @Post('venues/:id/favourite')
  @UseGuards(JwtAuthGuard)
  favourite(@Req() req: AuthedReq, @Param('id') id: string, @Body('on') on: boolean) {
    return this.social.setFavouriteVenue(req.user.sub, id, on);
  }

  @Get('organizers/:id/reviews')
  reviews(@Param('id') id: string) {
    return this.social.reviews(id);
  }

  @Post('organizers/:id/reviews')
  @UseGuards(JwtAuthGuard)
  addReview(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body('rating') rating: number,
    @Body('text') text: string,
  ) {
    return this.social.addReview(req.user.sub, id, rating, text);
  }

  @Get('venues/:id/reviews')
  venueReviews(@Param('id') id: string) {
    return this.social.venueReviews(id);
  }

  @Post('venues/:id/reviews')
  @UseGuards(JwtAuthGuard)
  addVenueReview(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body('rating') rating: number,
    @Body('text') text: string,
  ) {
    return this.social.addVenueReview(req.user.sub, id, rating, text);
  }
}
