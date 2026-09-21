import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { ArrowLeft, Banknote, Calendar, Check, Clock, Eye, Ticket, Upload, X } from 'lucide-react-native';
import { organizer } from '../../api/organizer';
import { catalog } from '../../api/catalog';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, Checkbox, Chip, IconButton, Input, Muted, Notice, Screen, Txt } from '../../components/ui';
import SearchableSelect from '../../components/SearchableSelect';
import Accordion from '../../components/Accordion';
import ImageUploadBox from '../../components/ImageUploadBox';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import { htmlToPlainText, plainTextToHtml } from '../../lib/richtext';
import type { EventsStackParamList } from '../../navigation/types';
import type { CollaboratorOption, Event, LineupProfile, PromoterProfile, Venue } from '../../types';

// Rules/Promoters/SEO are edit-only (per organizer feedback 2026-09-15) —
// during creation those default silently (empty rules stay DEFAULT_RULES,
// promoters stay off, SEO falls back to title/description) and the
// organizer can fill them in later via Edit. Line-up stays in the create
// flow. Editing an existing event keeps the full original 6-step flow so
// nothing already set is hidden.
const CREATE_STEPS = ['1 Basics', '2 Media', '3 Tickets', '4 Co-hosts & line-up'];
const EDIT_STEPS = ['1 Basics', '2 Media', '3 Tickets', '4 Rules & line-up', '5 Promoters', '6 SEO & publish'];
const INCLUDE_OPTIONS = ['Entry', 'Welcome drink', 'Food coupon', 'Standing zone', 'Lounge access', '2 drinks', 'Meet & greet'];
const AGE_LIMITS = ['All ages', '18+', '21+'];

const formatDateDMY = (d: Date) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
const formatTime12h = (d: Date) => {
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  const h = d.getHours() % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

interface TierDraft {
  id?: string;
  name: string;
  price: string;
  quantity: string;
  includes: string[];
  description: string;
  coverCharge: string;
  coverChargeNote: string;
  freeCutoff: string;
  lateFeePrice: string;
}
const DEFAULT_TIERS: TierDraft[] = [{ name: 'General', price: '29', quantity: '500', includes: ['Entry', 'Welcome drink'], description: '', coverCharge: '', coverChargeNote: '', freeCutoff: '', lateFeePrice: '' }];

interface RuleDraft { title: string; body: string }
const DEFAULT_RULES: RuleDraft[] = [
  { title: 'Dress code', body: 'Smart casual — no flip-flops or sleeveless shirts.' },
  { title: 'Food & drinks', body: 'Full bar inside. Outside food & drinks not permitted.' },
  { title: 'Prohibited items', body: 'No weapons, illegal substances or professional cameras.' },
];

/** Faithful port of prebooze-web/src/pages/organizer/CreateEvent.tsx — same
 * POST /organizer/events upsert semantics, same real media uploads (POST
 * /organizer/upload). Real, disclosed simplifications vs web (noted inline
 * at each point): description is plain text, not the web WYSIWYG HTML
 * editor; teaser reel is link-only, the upload-a-file path is dropped; the
 * final "Preview" is a compact summary card, not a pixel-accurate replica
 * of the guest-facing detail page. Date/time use the real native Android
 * picker dialogs (DD-MM-YYYY / 12-hour display) — everything else, every
 * field, validation rule and payload shape, matches web exactly.
 * Step count differs from web on purpose: creating a new event only walks
 * Basics/Media/Tickets/Line-up (Rules, Promoters and SEO default silently
 * and are edited later); editing an existing event keeps all 6 original
 * steps so nothing already set is hidden. */
export default function EventWizardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<EventsStackParamList>>();
  const route = useRoute<RouteProp<EventsStackParamList, 'EventWizard'>>();
  const editId = route.params?.eventId;
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [venues, setVenues] = useState<Venue[]>([]);
  const [lineups, setLineups] = useState<LineupProfile[]>([]);
  const [promoters, setPromoters] = useState<PromoterProfile[]>([]);
  const [collaboratorOptions, setCollaboratorOptions] = useState<CollaboratorOption[]>([]);
  const [collaboratorSel, setCollaboratorSel] = useState<string[]>([]);
  const [editing, setEditing] = useState<Event | undefined>(undefined);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Concerts');
  const [subCategory, setSubCategory] = useState('');
  const [categories, setCategories] = useState<{ name: string; icon: string; subs: string[] }[]>([]);
  const subsFor = (cat: string) => categories.find((c) => c.name === cat)?.subs ?? [];
  const [ageLimit, setAgeLimit] = useState('18+');
  const [eventDate, setEventDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(20, 0, 0, 0);
    return d;
  });
  const [duration, setDuration] = useState('3');
  // A festival/workshop running over several days — the event stays
  // bookable/live through the end of seriesEndDate instead of ending after
  // just the first day's date+durationHrs (see lib/events.ts's isEventOver).
  // Faithful port of the admin EventEditorReal.tsx pattern.
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [seriesEndDate, setSeriesEndDate] = useState<Date | null>(null);
  const [venueId, setVenueId] = useState('');
  const [venueCity, setVenueCity] = useState(user?.city ?? '');
  const [privateAddress, setPrivateAddress] = useState(false);
  const [liveCities, setLiveCities] = useState<string[]>([]);
  const [privateCity, setPrivateCity] = useState('');
  const [privateLocality, setPrivateLocality] = useState('');

  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [teaserVideoUrl, setTeaserVideoUrl] = useState<string | null>(null);
  const [socialPostUrl, setSocialPostUrl] = useState('');
  const [socialStoryUrl, setSocialStoryUrl] = useState('');
  const [posterUploading, setPosterUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [socialPostUploading, setSocialPostUploading] = useState(false);
  const [socialStoryUploading, setSocialStoryUploading] = useState(false);
  const mediaUploading = posterUploading || galleryUploading || socialPostUploading || socialStoryUploading;

  const [tiers, setTiers] = useState<TierDraft[]>(DEFAULT_TIERS);
  const [customIncludeInputs, setCustomIncludeInputs] = useState<Record<number, string>>({});

  const [conditions, setConditions] = useState('Photo ID required\nNo re-entry');
  const [rules, setRules] = useState<RuleDraft[]>(DEFAULT_RULES);
  const [lineupSel, setLineupSel] = useState<{ name: string; role: string }[]>([]);

  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoCap, setPromoCap] = useState('200');
  const [promoCutoff, setPromoCutoff] = useState('01:00');
  const [allowedPromoters, setAllowedPromoters] = useState<string[]>([]);
  const [guestListPromoters, setGuestListPromoters] = useState<string[]>([]);
  const [commissionPromoters, setCommissionPromoters] = useState<string[]>([]);
  const [perHead, setPerHead] = useState(false);
  const [perHeadAmt, setPerHeadAmt] = useState('100');
  const [allowTeams, setAllowTeams] = useState(false);
  const [revenueShare, setRevenueShare] = useState<Record<string, string>>({});
  const togglePromoter = (slug: string) => {
    setAllowedPromoters((prev) => {
      if (prev.includes(slug)) {
        setGuestListPromoters((g) => g.filter((x) => x !== slug));
        setCommissionPromoters((c) => c.filter((x) => x !== slug));
        return prev.filter((x) => x !== slug);
      }
      setGuestListPromoters((g) => (g.includes(slug) ? g : [...g, slug]));
      return [...prev, slug];
    });
  };
  const toggleGuestList = (slug: string) => setGuestListPromoters((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));
  const toggleCommission = (slug: string) => setCommissionPromoters((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));

  const [seoTitle, setSeoTitle] = useState('');
  const [seoDesc, setSeoDesc] = useState('');
  const [seoSlug, setSeoSlug] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');

  useEffect(() => {
    // Editing: fetch every city's venues unfiltered, so the event's existing
    // venue is guaranteed to be in the list regardless of which city it's
    // in — venueCity is then inferred from that venue once found, below.
    // Creating: scope to the organizer's own city by default (see item 6),
    // narrower and more useful than showing every venue in the country.
    Promise.all([
      catalog.venues(editId ? undefined : (venueCity || undefined)),
      catalog.lineups(),
      catalog.promoters(),
      catalog.categories(),
      catalog.cities(),
      organizer.collaboratorOptions().catch(() => [] as CollaboratorOption[]),
      editId ? organizer.events().then((evs) => evs.find((e) => e.id === editId)) : Promise.resolve(undefined),
    ])
      .then(([vs, ls, ps, cats, cities, collabs, ev]) => {
        setVenues(vs);
        setLineups(ls);
        setPromoters(ps);
        setCollaboratorOptions(collabs);
        setCategories(cats);
        setLiveCities(cities.map((c) => c.name).sort());
        const subsForCat = (cat: string) => cats.find((c) => c.name === cat)?.subs ?? [];
        if (!ev) setSubCategory(subsForCat(category)[0] ?? '');
        if (ev) {
          setEditing(ev);
          setTitle(ev.title);
          setDescription(htmlToPlainText(ev.description));
          setCategory(ev.category);
          setSubCategory(ev.subCategory ?? subsForCat(ev.category)[0] ?? '');
          setAgeLimit(ev.ageLimit);
          setEventDate(new Date(ev.date));
          setDuration(String(ev.durationHrs));
          setIsMultiDay(!!ev.seriesEndDate);
          setSeriesEndDate(ev.seriesEndDate ? new Date(ev.seriesEndDate) : null);
          if (ev.venueId) {
            setVenueId(ev.venueId);
            const evVenue = vs.find((v) => v.id === ev.venueId);
            if (evVenue) setVenueCity(evVenue.city);
          } else {
            setPrivateAddress(true);
            setPrivateCity(ev.privateCity ?? '');
            setPrivateLocality(ev.privateLocality ?? '');
          }
          setPosterUrl(ev.posterUrl ?? null);
          setGalleryUrls(ev.galleryUrls ?? []);
          setTeaserVideoUrl(ev.teaserVideoUrl ?? null);
          setSocialPostUrl(ev.socialBanners?.postUrl ?? '');
          setSocialStoryUrl(ev.socialBanners?.storyUrl ?? '');
          setTiers(ev.tiers.map((t) => ({ id: t.id, name: t.name, price: String(t.price), quantity: String(t.quantity), includes: t.includes, description: t.description ?? '', coverCharge: t.coverCharge ? String(t.coverCharge) : '', coverChargeNote: t.coverChargeNote ?? '', freeCutoff: t.freeCutoff ?? '', lateFeePrice: t.lateFeePrice != null ? String(t.lateFeePrice) : '' })));
          setConditions(ev.conditions.join('\n'));
          setRules(ev.rules.length ? ev.rules.map((r) => ({ title: r.title, body: r.body })) : DEFAULT_RULES);
          setLineupSel(ev.lineup);
          setCollaboratorSel(ev.collaboratorOrganizerIds);
          const pc = ev.promoterConfig;
          if (pc) {
            setPromoEnabled(pc.enabled);
            setPromoCap(String(pc.cap));
            setPromoCutoff(pc.cutoff);
            setAllowedPromoters(pc.allowedPromoters);
            setGuestListPromoters(pc.guestListPromoters ?? pc.allowedPromoters);
            setPerHead(pc.perHeadPayout);
            setPerHeadAmt(String(pc.perHeadAmount));
            setAllowTeams(pc.allowTeams);
            setRevenueShare(Object.fromEntries(Object.entries(pc.revenueShare ?? {}).map(([slug, pct]) => [slug, String(pct)])));
            setCommissionPromoters(Object.entries(pc.revenueShare ?? {}).filter(([, pct]) => (pct as number) > 0).map(([slug]) => slug));
          }
          setSeoTitle(ev.seo?.title ?? '');
          setSeoDesc(ev.seo?.description ?? '');
          setSeoSlug(ev.seo?.slug ?? '');
          setSeoKeywords(Array.isArray(ev.seo?.keywords) ? (ev.seo?.keywords as unknown as string[]).join(', ') : ev.seo?.keywords ?? '');
        } else if (vs.length) {
          setVenueId(vs[0].id);
        }
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const toggleLineup = (l: { name: string; role: string }) =>
    setLineupSel((prev) => (prev.some((x) => x.name === l.name) ? prev.filter((x) => x.name !== l.name) : [...prev, l]));
  const venueLabel = (v: Venue) => `${v.name} · ${v.locality || v.city}`;
  const setRule = (i: number, patch: Partial<RuleDraft>) => setRules((prev) => prev.map((r, x) => (x === i ? { ...r, ...patch } : r)));

  const slug = useMemo(
    () => (seoSlug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    [seoSlug, title],
  );

  const step1Valid = !!(title.trim() && (privateAddress ? privateCity.trim() && privateLocality.trim() : venueId));
  const tiersValid = tiers.length > 0 && tiers.every((t) => t.name.trim() && t.price.trim() !== '' && +t.price >= 0 && +t.quantity > 0 && (!t.freeCutoff || +t.lateFeePrice > 0));

  const buildPayload = (status: 'draft' | 'pending') => ({
    id: editing?.id,
    title: title.trim() || 'Untitled event',
    description: description.trim(),
    category,
    subCategory,
    ageLimit,
    tags: [category === 'Concerts' ? 'Concert' : category, ageLimit],
    date: eventDate.toISOString(),
    durationHrs: +duration,
    seriesEndDate: isMultiDay && seriesEndDate ? new Date(seriesEndDate.getFullYear(), seriesEndDate.getMonth(), seriesEndDate.getDate(), 23, 59, 59).toISOString() : null,
    ...(privateAddress ? { privateCity: privateCity.trim(), privateLocality: privateLocality.trim() } : { venueId }),
    status,
    conditions: conditions.split('\n').filter(Boolean),
    rules: rules.filter((r) => r.title.trim() || r.body.trim()),
    collaboratorOrganizerIds: collaboratorSel,
    lineup: lineupSel,
    posterUrl,
    galleryUrls,
    teaserVideoUrl,
    socialBanners: { postUrl: socialPostUrl || undefined, storyUrl: socialStoryUrl || undefined },
    tiers: tiers.map((t) => ({
      id: t.id,
      name: t.name.trim(),
      price: +t.price,
      quantity: +t.quantity,
      includes: t.includes,
      description: t.description.trim() || undefined,
      coverCharge: t.coverCharge.trim() ? +t.coverCharge : undefined,
      coverChargeNote: t.coverChargeNote.trim() || undefined,
      freeCutoff: +t.price === 0 && t.freeCutoff.trim() ? t.freeCutoff.trim() : undefined,
      lateFeePrice: +t.price === 0 && t.freeCutoff.trim() && t.lateFeePrice.trim() ? +t.lateFeePrice : undefined,
    })),
    seo: { title: seoTitle || `${title} | tickets`, description: seoDesc || description.slice(0, 160), slug, keywords: seoKeywords },
    promoterConfig: {
      enabled: promoEnabled,
      cap: +promoCap || 0,
      cutoff: promoCutoff,
      allowedPromoters,
      guestListPromoters,
      perHeadPayout: perHead,
      perHeadAmount: +perHeadAmt || 0,
      allowTeams,
      revenueShare: Object.fromEntries(
        allowedPromoters.filter((s) => commissionPromoters.includes(s)).map((s) => [s, +revenueShare[s] || 0] as const).filter(([, pct]) => pct > 0),
      ),
    },
  });

  const save = async (status: 'draft' | 'pending') => {
    setErr('');
    if (mediaUploading) { setErr('Media is still uploading — wait for it to finish before saving'); return; }
    setSaving(true);
    try {
      // buildPayload's description is plain text (also used as-is for the
      // Preview screen's own display) — convert to the div-per-line HTML
      // shape only at the actual save boundary, not inside buildPayload
      // itself, so Preview never shows raw tags.
      await organizer.upsertEvent({ ...buildPayload(status), description: plainTextToHtml(description.trim()) });
      navigation.goBack();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to save event');
      setSaving(false);
    }
  };

  const venue = venues.find((v) => v.id === venueId);
  const cityForSeo = venue?.city ?? (privateAddress ? privateCity : '');
  const venuePhotosToAdd = (venue?.galleryUrls ?? []).filter((u) => !galleryUrls.includes(u));
  const setTier = (i: number, patch: Partial<TierDraft>) => setTiers((prev) => prev.map((t, x) => (x === i ? { ...t, ...patch } : t)));
  const addCustomInclude = (i: number) => {
    const val = (customIncludeInputs[i] ?? '').trim();
    if (!val) return;
    const t = tiers[i];
    if (!t.includes.includes(val)) setTier(i, { includes: [...t.includes, val] });
    setCustomIncludeInputs((prev) => ({ ...prev, [i]: '' }));
  };

  const changeVenueCity = async (city: string) => {
    setVenueCity(city);
    try {
      const vs = await catalog.venues(city || undefined);
      setVenues(vs);
      if (!vs.some((v) => v.id === venueId)) setVenueId(vs[0]?.id ?? '');
    } catch {
      // keep the previous list on failure — the field just won't narrow
    }
  };

  const openDatePicker = () => {
    DateTimePickerAndroid.open({
      value: eventDate,
      mode: 'date',
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) {
          setEventDate((prev) => {
            const d = new Date(prev);
            d.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
            return d;
          });
        }
      },
    });
  };
  const openTimePicker = () => {
    DateTimePickerAndroid.open({
      value: eventDate,
      mode: 'time',
      is24Hour: false,
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) {
          setEventDate((prev) => {
            const d = new Date(prev);
            d.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
            return d;
          });
        }
      },
    });
  };
  const openSeriesEndDatePicker = () => {
    DateTimePickerAndroid.open({
      value: seriesEndDate ?? eventDate,
      mode: 'date',
      minimumDate: eventDate,
      onChange: (event, selected) => {
        if (event.type === 'set' && selected) setSeriesEndDate(selected);
      },
    });
  };

  const pickGalleryImage = async () => {
    if (galleryUrls.length >= 6) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setGalleryUploading(true);
    try {
      const res = await organizer.upload(asset.uri, asset.fileName ?? `gallery-${Date.now()}.jpg`, asset.mimeType ?? 'image/jpeg');
      setGalleryUrls((prev) => [...prev, res.url].slice(0, 6));
    } catch {
      setErr('Gallery upload failed — try again');
    } finally {
      setGalleryUploading(false);
    }
  };

  if (!ready) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </Screen>
    );
  }

  if (preview) {
    const ev = buildPayload('pending');
    return (
      <Screen>
        <View style={styles.header}>
          <Eye size={18} color={colors.text} />
          <Txt style={styles.headerTitle}>Preview</Txt>
        </View>
        <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
          {!!err && (
            <View style={styles.errRow}>
              <X size={14} color={colors.danger} />
              <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
            </View>
          )}
          <Card style={styles.previewCard}>
            <Txt style={styles.previewTitle}>{ev.title}</Txt>
            <Muted style={styles.tiny}>{formatDateDMY(eventDate)} · {formatTime12h(eventDate)} · {ev.durationHrs} hrs</Muted>
            <Muted style={styles.tiny}>{venue ? `${venue.name}, ${venue.city}` : privateAddress ? `${privateLocality}, ${privateCity}` : ''}</Muted>
            <View style={styles.chipRow}>
              {ev.tags.map((t) => <Badge key={t} label={t} />)}
            </View>
            {!!ev.description && <Txt style={styles.previewDesc}>{ev.description}</Txt>}
            <View style={styles.divider} />
            <Muted style={styles.tiny}>{ev.tiers.map((t) => `${t.name} ₹${t.price}`).join(' · ')}</Muted>
          </Card>
          <Muted style={styles.footerNote}>After submit: status Pending admin approval → goes live once approved</Muted>
          <View style={styles.navRow}>
            <Button label="Keep editing" variant="ghost" onPress={() => setPreview(false)} style={{ flex: 1 }} />
            <Button label={mediaUploading ? 'Uploading…' : saving ? 'Submitting…' : 'Submit for approval'} disabled={saving || mediaUploading} onPress={() => save('pending')} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const isEdit = !!editing;
  const WIZARD_STEPS = isEdit ? EDIT_STEPS : CREATE_STEPS;
  const lastStepIndex = WIZARD_STEPS.length - 1;

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <Txt style={styles.headerTitle} numberOfLines={1}>{editing ? `Edit — ${editing.title}` : 'Create event'}</Txt>
      </View>
      {editing && (
        <View style={styles.editNoticeWrap}>
          <Notice tone="warning">Submitting these edits sends the event back for admin review — it won't be live again until it's re-approved.</Notice>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepRowScroll} contentContainerStyle={styles.stepRow}>
        {WIZARD_STEPS.map((s, i) => (
          <Pressable key={s} onPress={() => setStep(i)} style={[styles.stepPill, i === step && styles.stepPillOn]}>
            <Txt style={[styles.stepPillLabel, i === step && styles.stepPillLabelOn]}>{s}</Txt>
            {i < step && <Check size={12} color={colors.accent} />}
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content}>
        {!!err && (
          <View style={styles.errRow}>
            <X size={14} color={colors.danger} />
            <Txt style={{ color: colors.danger, fontSize: fontSize.s }}>{err}</Txt>
          </View>
        )}

        {step === 0 && (
          <Card style={styles.stepCard}>
            <FieldLabel>Event title</FieldLabel>
            <Input value={title} onChangeText={setTitle} placeholder="Event title" style={styles.fieldGap} />
            <FieldLabel>Description</FieldLabel>
            <Input value={description} onChangeText={setDescription} placeholder="What's this event about?" multiline numberOfLines={4} style={[styles.fieldGap, styles.textarea]} />

            <FieldLabel>Category</FieldLabel>
            <ChipWrap>
              {categories.map((c) => (
                <Chip key={c.name} label={c.name} active={category === c.name} onPress={() => { setCategory(c.name); setSubCategory(subsFor(c.name)[0] ?? ''); }} />
              ))}
            </ChipWrap>
            {subsFor(category).length > 0 && (
              <>
                <FieldLabel>Sub-category</FieldLabel>
                <ChipWrap>
                  {subsFor(category).map((s) => <Chip key={s} label={s} active={subCategory === s} onPress={() => setSubCategory(s)} />)}
                </ChipWrap>
              </>
            )}
            <FieldLabel>Age limit</FieldLabel>
            <ChipWrap>
              {AGE_LIMITS.map((a) => <Chip key={a} label={a} active={ageLimit === a} onPress={() => setAgeLimit(a)} />)}
            </ChipWrap>

            <View style={styles.row3}>
              <View style={styles.flex1}>
                <FieldLabel>Date</FieldLabel>
                <Pressable style={[styles.pickerField, styles.fieldGap]} onPress={openDatePicker}>
                  <Txt>{formatDateDMY(eventDate)}</Txt>
                  <Calendar size={16} color={colors.muted} />
                </Pressable>
              </View>
              <View style={styles.flex1}>
                <FieldLabel>Time</FieldLabel>
                <Pressable style={[styles.pickerField, styles.fieldGap]} onPress={openTimePicker}>
                  <Txt>{formatTime12h(eventDate)}</Txt>
                  <Clock size={16} color={colors.muted} />
                </Pressable>
              </View>
            </View>
            <FieldLabel>Total duration (hours)</FieldLabel>
            <Input value={duration} onChangeText={(v) => setDuration(v.replace(/[^0-9.]/g, '').slice(0, 4))} placeholder="e.g. 5 or 6.5" keyboardType="decimal-pad" style={styles.fieldGap} />
            <Muted style={styles.tiny}>
              For a single-day event, this is the whole session length. For a multi-day series, this is just the daily session length (e.g. 1 hour for a nightly 8-9 PM class) — the date above is the first day's start.
            </Muted>

            <View style={{ marginTop: spacing.m }}>
              <Checkbox checked={isMultiDay} onChange={setIsMultiDay} label="Multi-day event (workshop/series running over several days)" />
            </View>
            {isMultiDay && (
              <>
                <FieldLabel>Series ends on</FieldLabel>
                <Pressable style={[styles.pickerField, styles.fieldGap]} onPress={openSeriesEndDatePicker}>
                  <Txt>{seriesEndDate ? formatDateDMY(seriesEndDate) : 'select the last day…'}</Txt>
                  <Calendar size={16} color={colors.muted} />
                </Pressable>
                <Muted style={styles.tiny}>The event stays bookable and "live" (not sold out/ended) until the end of this day, regardless of the daily session's short duration above.</Muted>
              </>
            )}

            <Checkbox checked={privateAddress} onChange={setPrivateAddress} label="Keep exact address private — I'll share it with guests myself" />

            {privateAddress ? (
              <View style={styles.fieldGap}>
                <FieldLabel>City</FieldLabel>
                <SearchableSelect value={privateCity} onChange={setPrivateCity} options={liveCities} placeholder="search cities…" />
                <Input value={privateLocality} onChangeText={setPrivateLocality} placeholder="Locality, e.g. Banjara Hills" style={{ marginTop: spacing.s }} />
                <Muted style={styles.tiny}>
                  Guests will only ever see "{privateLocality || 'locality'}, {privateCity || 'city'}" — no venue name, no address, no map.
                </Muted>
              </View>
            ) : (
              <View style={styles.fieldGap}>
                <FieldLabel>City</FieldLabel>
                <SearchableSelect value={venueCity} onChange={changeVenueCity} options={liveCities} placeholder="All cities" />
                <FieldLabel>Venue</FieldLabel>
                <SearchableSelect
                  value={venue ? venueLabel(venue) : ''}
                  onChange={(label) => { const v = venues.find((vv) => venueLabel(vv) === label); if (v) setVenueId(v.id); }}
                  options={venues.map(venueLabel)}
                  placeholder={venueCity ? `search venues in ${venueCity}…` : 'search venues…'}
                />
                <Muted style={styles.tiny}>Venue not listed? They need to register as a Prebooze venue partner first, or change city above to see other venues.</Muted>
              </View>
            )}

            <View style={styles.navRow}>
              <Button label={mediaUploading ? 'Uploading…' : saving ? 'Saving…' : 'Save draft'} variant="ghost" disabled={saving || mediaUploading} onPress={() => save('draft')} style={{ flex: 1 }} />
              <Button label="Next: Media" disabled={!step1Valid} onPress={() => setStep(1)} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        {step === 1 && (
          <Card style={styles.stepCard}>
            <Txt style={styles.stepTitle}>Event media</Txt>
            <Muted style={[styles.tiny, { marginBottom: spacing.m }]}>All optional — a poster helps your event stand out, everything else is a nice-to-have.</Muted>

            <FieldLabel>Poster (portrait 3:4)</FieldLabel>
            <View style={styles.fieldGap}>
              <ImageUploadBox value={posterUrl} onChange={setPosterUrl} onBusyChange={setPosterUploading} width={140} height={187} label="upload poster" />
            </View>

            <FieldLabel>Gallery photos (optional, up to 6)</FieldLabel>
            {venuePhotosToAdd.length > 0 && (
              <Button
                label={`+ Use ${venue!.name}'s photos (${venuePhotosToAdd.length})`}
                variant="ghost"
                onPress={() => setGalleryUrls((prev) => [...prev, ...venuePhotosToAdd].slice(0, 6))}
                style={styles.galleryUseBtn}
              />
            )}
            <View style={styles.galleryRow}>
              {galleryUrls.map((u) => (
                <View key={u} style={styles.galleryThumbWrap}>
                  <ImageUploadBox value={u} onChange={() => setGalleryUrls((prev) => prev.filter((x) => x !== u))} width={72} height={96} label="" />
                </View>
              ))}
              {galleryUrls.length < 6 && (
                <Pressable style={styles.galleryAddTile} onPress={pickGalleryImage} disabled={galleryUploading}>
                  {galleryUploading ? <ActivityIndicator color={colors.accent} /> : <Upload size={16} color={colors.muted} />}
                </Pressable>
              )}
            </View>

            <FieldLabel>Teaser reel link (optional)</FieldLabel>
            <Input value={teaserVideoUrl ?? ''} onChangeText={(v) => setTeaserVideoUrl(v || null)} placeholder="Instagram Reel, YouTube, or a direct video link" style={styles.fieldGap} />

            <View style={styles.row3}>
              <View style={styles.flex1}>
                <FieldLabel>Social post (1:1, optional)</FieldLabel>
                <ImageUploadBox value={socialPostUrl || null} onChange={(v) => setSocialPostUrl(v ?? '')} onBusyChange={setSocialPostUploading} width={90} height={90} label="post 1:1" />
              </View>
              <View style={styles.flex1}>
                <FieldLabel>Social story (9:16, optional)</FieldLabel>
                <ImageUploadBox value={socialStoryUrl || null} onChange={(v) => setSocialStoryUrl(v ?? '')} onBusyChange={setSocialStoryUploading} width={90} height={160} label="story 9:16" />
              </View>
            </View>

            <View style={styles.navRow}>
              <Button label="Back" variant="ghost" onPress={() => setStep(0)} style={{ flex: 1 }} />
              <Button label="Next: Tickets" onPress={() => setStep(2)} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        {step === 2 && (
          <Card style={styles.stepCard}>
            <Txt style={styles.stepTitle}>Ticket tiers</Txt>
            {tiers.map((t, i) => {
              const isFree = t.price === '0';
              const effectivePrice = isFree && t.freeCutoff && +t.lateFeePrice > 0 ? +t.lateFeePrice : +t.price || 0;
              return (
                <Card key={i} style={styles.tierCard}>
                  <View style={styles.chipRow}>
                    <Chip label="Free guest list" active={isFree} onPress={() => setTier(i, { price: '0' })} />
                    <Chip label="Paid ticket" active={!isFree} onPress={() => setTier(i, { price: isFree ? '' : t.price })} />
                  </View>
                  <View style={styles.row3}>
                    <View style={styles.flex1}>
                      <FieldLabel>Tier name</FieldLabel>
                      <Input value={t.name} onChangeText={(v) => setTier(i, { name: v })} style={styles.fieldGap} />
                    </View>
                    <View style={styles.flex1}>
                      <FieldLabel>Price ₹</FieldLabel>
                      {isFree ? (
                        <Input value="0 · Free" editable={false} style={styles.fieldGap} />
                      ) : (
                        <Input value={t.price} onChangeText={(v) => setTier(i, { price: v })} keyboardType="numeric" placeholder="e.g. 499" style={styles.fieldGap} />
                      )}
                    </View>
                  </View>
                  <View style={[styles.row3, styles.rowAlignEnd]}>
                    <View style={styles.flex1}>
                      <FieldLabel>Qty</FieldLabel>
                      <Input value={t.quantity} onChangeText={(v) => setTier(i, { quantity: v })} keyboardType="numeric" style={styles.fieldGap} />
                    </View>
                    <IconButton tone="danger" disabled={tiers.length === 1} onPress={() => setTiers((prev) => prev.filter((_, x) => x !== i))} style={styles.tierRemoveBtn}>
                      <X size={15} color={tiers.length === 1 ? colors.muted : colors.danger} />
                    </IconButton>
                  </View>
                  <FieldLabel>Ticket description</FieldLabel>
                  <Input value={t.description} onChangeText={(v) => setTier(i, { description: v })} placeholder="e.g. Best value — entry, welcome drink and both stages" style={styles.fieldGap} />
                  <View style={styles.row3}>
                    <View style={styles.flex1}>
                      <FieldLabel>Cover charge ₹ (optional)</FieldLabel>
                      <Input value={t.coverCharge} onChangeText={(v) => setTier(i, { coverCharge: v })} keyboardType="numeric" placeholder="e.g. 1000" style={styles.fieldGap} />
                    </View>
                    <View style={styles.flex1}>
                      <FieldLabel>Redeemable for (optional)</FieldLabel>
                      <Input value={t.coverChargeNote} onChangeText={(v) => setTier(i, { coverChargeNote: v })} placeholder="e.g. food & drinks" style={styles.fieldGap} />
                    </View>
                  </View>
                  {t.coverCharge.trim() && +t.coverCharge > effectivePrice ? (
                    <Muted style={[styles.tiny, { color: colors.danger, marginBottom: spacing.s }]}>Cover charge can't exceed the ticket price</Muted>
                  ) : t.coverCharge.trim() && +t.coverCharge > 0 ? (
                    <Muted style={[styles.tiny, { marginBottom: spacing.s }]}>
                      Guests see this ticket includes ₹{t.coverCharge} redeemable at the venue{t.coverChargeNote.trim() ? ` (${t.coverChargeNote.trim()})` : ''}.
                    </Muted>
                  ) : null}
                  {isFree && (
                    <View style={styles.row3}>
                      <View style={styles.flex1}>
                        <FieldLabel>Free until (optional)</FieldLabel>
                        <Input value={t.freeCutoff} onChangeText={(v) => setTier(i, { freeCutoff: v })} placeholder="HH:MM" style={styles.fieldGap} />
                      </View>
                      {!!t.freeCutoff && (
                        <View style={styles.flex1}>
                          <FieldLabel>Price after grace period ₹</FieldLabel>
                          <Input value={t.lateFeePrice} onChangeText={(v) => setTier(i, { lateFeePrice: v })} keyboardType="numeric" placeholder="e.g. 200" style={styles.fieldGap} />
                        </View>
                      )}
                    </View>
                  )}
                  {isFree && t.freeCutoff && !(+t.lateFeePrice > 0) && (
                    <Muted style={[styles.tiny, { color: colors.danger, marginBottom: spacing.s }]}>Set a price after the grace period, or clear the cutoff time</Muted>
                  )}
                  <Muted style={styles.tiny}>What's included:</Muted>
                  <ChipWrap>
                    {Array.from(new Set([...INCLUDE_OPTIONS, ...t.includes])).map((opt) => (
                      <Chip
                        key={opt}
                        label={t.includes.includes(opt) ? `${opt} ✓` : opt}
                        active={t.includes.includes(opt)}
                        onPress={() => setTier(i, { includes: t.includes.includes(opt) ? t.includes.filter((x) => x !== opt) : [...t.includes, opt] })}
                      />
                    ))}
                  </ChipWrap>
                  <View style={styles.customIncludeRow}>
                    <Input
                      value={customIncludeInputs[i] ?? ''}
                      onChangeText={(v) => setCustomIncludeInputs((prev) => ({ ...prev, [i]: v }))}
                      placeholder="Add custom…"
                      style={styles.customIncludeInput}
                      onSubmitEditing={() => addCustomInclude(i)}
                    />
                    <Chip label="+ Add" onPress={() => addCustomInclude(i)} />
                  </View>
                </Card>
              );
            })}
            <Button
              label="+ Add tier"
              variant="accentOutline"
              onPress={() => setTiers((prev) => [...prev, { name: 'VIP', price: '79', quantity: '50', includes: ['Entry', 'Lounge access'], description: '', coverCharge: '', coverChargeNote: '', freeCutoff: '', lateFeePrice: '' }])}
            />
            <View style={styles.navRow}>
              <Button label="Back" variant="ghost" onPress={() => setStep(1)} style={{ flex: 1 }} />
              <Button label={isEdit ? 'Next: Rules & line-up' : 'Next: Co-hosts & line-up'} disabled={!tiersValid} onPress={() => setStep(3)} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        {step === 3 && (
          <Card style={styles.stepCard}>
            {isEdit && (
              <>
                <FieldLabel>Event conditions (one per line)</FieldLabel>
                <Input value={conditions} onChangeText={setConditions} multiline numberOfLines={4} style={[styles.fieldGap, styles.textarea]} />
                <Txt style={styles.stepTitle}>Event rules</Txt>
                {rules.map((r, i) => (
                  <View key={i} style={styles.ruleRow}>
                    <View style={{ flex: 1 }}>
                      <Input value={r.title} onChangeText={(v) => setRule(i, { title: v })} placeholder="e.g. Age policy" style={styles.fieldGap} />
                      <Input value={r.body} onChangeText={(v) => setRule(i, { body: v })} placeholder="Details" style={{ marginTop: spacing.s }} />
                    </View>
                    <IconButton tone="danger" onPress={() => setRules((prev) => prev.filter((_, x) => x !== i))}>
                      <X size={14} color={colors.danger} />
                    </IconButton>
                  </View>
                ))}
                <View style={{ marginBottom: spacing.l }}>
                  <Chip label="+ Add rule" onPress={() => setRules((prev) => [...prev, { title: '', body: '' }])} />
                </View>
              </>
            )}

            {/* New for this app (2026-09-17), ported from web's
                CreateEvent.tsx — shown in both create and edit (per explicit
                user request 2026-09-17: unlike Rules/Promoters/SEO, a
                co-host is worth surfacing upfront since revenue/commission
                start splitting from the very first sale). */}
            <Txt style={styles.stepTitle}>Co-organizers</Txt>
            <SearchableSelect
              value=""
              onChange={(name) => {
                const c = collaboratorOptions.find((x) => x.brandName === name);
                if (!c || collaboratorSel.includes(c.id)) return;
                setCollaboratorSel((prev) => [...prev, c.id]);
              }}
              options={collaboratorOptions.filter((c) => !collaboratorSel.includes(c.id)).map((c) => c.brandName)}
              placeholder="search organizers to add as a co-host…"
            />
            <Muted style={[styles.tiny, { marginVertical: spacing.s }]}>
              A tagged co-organizer gets full access to this event — bookings, attendees, revenue, and commission —
              and it shows on both your public profiles. Not registered on Prebooze yet? They can't be tagged;
              mention them in the description instead.
            </Muted>
            {collaboratorSel.length > 0 && (
              <ChipWrap>
                {collaboratorSel.map((id) => {
                  const c = collaboratorOptions.find((x) => x.id === id);
                  return (
                    <Chip
                      key={id}
                      label={`${c?.brandName ?? id} ✕`}
                      active
                      onPress={() => setCollaboratorSel((prev) => prev.filter((x) => x !== id))}
                    />
                  );
                })}
              </ChipWrap>
            )}

            <Txt style={styles.stepTitle}>Line-up & partners</Txt>
            <SearchableSelect
              value=""
              onChange={(name) => {
                const l = lineups.find((x) => x.name === name);
                if (!l) return;
                const role = l.category === 'DJ' ? 'Opening DJ' : l.category === 'Sponsor' ? 'Sponsor' : l.category === 'Promoter' ? 'Promoter' : 'Headline artist';
                toggleLineup({ name: l.name, role });
              }}
              options={lineups.filter((l) => !lineupSel.some((x) => x.name === l.name)).map((l) => l.name)}
              placeholder="search line-up & partners to add…"
            />
            <Muted style={[styles.tiny, { marginVertical: spacing.s }]}>Artist not listed? They need to register as a Prebooze line-up first.</Muted>
            {lineupSel.length > 0 && (
              <ChipWrap>
                {lineupSel.map((l) => (
                  <Chip key={l.name} label={`${l.name} (${l.role}) ✕`} active onPress={() => toggleLineup(l)} />
                ))}
              </ChipWrap>
            )}

            <View style={styles.navRow}>
              <Button label="Back" variant="ghost" onPress={() => setStep(2)} style={{ flex: 1 }} />
              {isEdit ? (
                <Button label="Next: Promoters" onPress={() => setStep(4)} style={{ flex: 1 }} />
              ) : (
                <Button label="Preview event" disabled={!step1Valid || !tiersValid} onPress={() => setPreview(true)} style={{ flex: 1 }} />
              )}
            </View>
          </Card>
        )}

        {isEdit && step === 4 && (
          <Card style={styles.stepCard}>
            <Txt style={styles.stepTitle}>Promoters</Txt>
            <Muted style={[styles.tiny, { marginBottom: spacing.m }]}>Let approved promoters bring free-entry guests, earn a commission on ticket sales, or both — you choose per promoter.</Muted>

            <View style={styles.enableBox}>
              <Checkbox checked={promoEnabled} onChange={setPromoEnabled} label="Enable promoters for this event" />
            </View>

            {promoEnabled && (
              <>
                <View style={styles.row3}>
                  <View style={styles.flex1}>
                    <FieldLabel>Free-entry cap (total passes)</FieldLabel>
                    <Input value={promoCap} onChangeText={(v) => setPromoCap(v.replace(/\D/g, ''))} keyboardType="numeric" style={styles.fieldGap} />
                  </View>
                  <View style={styles.flex1}>
                    <FieldLabel>Free entry valid before</FieldLabel>
                    <Input value={promoCutoff} onChangeText={setPromoCutoff} placeholder="HH:MM" style={styles.fieldGap} />
                  </View>
                </View>

                <FieldLabel>Allowed promoters</FieldLabel>
                <Muted style={[styles.tiny, { marginBottom: spacing.s }]}>Guest list = free entry, no ticket sold. Paid commission = a % of the ticket price on any sale through their link, added on top.</Muted>
                {promoters.map((p) => {
                  const isAllowed = allowedPromoters.includes(p.slug);
                  const hasGuestList = guestListPromoters.includes(p.slug);
                  const hasCommission = commissionPromoters.includes(p.slug);
                  return (
                    <View key={p.slug} style={styles.promoterBox}>
                      <Checkbox checked={isAllowed} onChange={() => togglePromoter(p.slug)} label={`${p.name}${p.verified ? ' ✓' : ''}`} />
                      {isAllowed && (
                        <View style={styles.promoterOptions}>
                          <View style={styles.promoterOptRow}>
                            <Checkbox checked={hasGuestList} onChange={() => toggleGuestList(p.slug)} label={<View style={styles.iconLabel}><Ticket size={13} color={colors.text} /><Txt style={fontStyleSmall}>Guest list</Txt></View>} />
                          </View>
                          <View style={styles.promoterOptRow}>
                            <Checkbox checked={hasCommission} onChange={() => toggleCommission(p.slug)} label={<View style={styles.iconLabel}><Banknote size={13} color={colors.text} /><Txt style={fontStyleSmall}>Paid commission</Txt></View>} />
                          </View>
                          {hasCommission && (
                            <View style={styles.revenueShareRow}>
                              <Input
                                value={revenueShare[p.slug] ?? ''}
                                onChangeText={(v) => setRevenueShare((prev) => ({ ...prev, [p.slug]: v.replace(/\D/g, '').slice(0, 3) }))}
                                keyboardType="numeric"
                                placeholder="0"
                                style={styles.revenueShareInput}
                              />
                              <Muted style={fontStyleSmall}>%</Muted>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
                {allowedPromoters.length === 0 && <Muted style={[styles.tiny, { color: colors.danger, marginTop: spacing.s }]}>Pick at least one promoter, or nobody can promote your event.</Muted>}

                <View style={styles.divider} />
                <Checkbox checked={perHead} onChange={setPerHead} label="Pay promoters per verified arrival" />
                {perHead && (
                  <View style={styles.perHeadField}>
                    <FieldLabel>₹ per confirmed check-in</FieldLabel>
                    <Input value={perHeadAmt} onChangeText={(v) => setPerHeadAmt(v.replace(/\D/g, ''))} keyboardType="numeric" style={styles.fieldGap} />
                  </View>
                )}
                <View style={{ marginTop: spacing.s }}>
                  <Checkbox checked={allowTeams} onChange={setAllowTeams} label="Allow promoter teams / sub-promoters" />
                </View>
              </>
            )}

            <View style={styles.navRow}>
              <Button label="Back" variant="ghost" onPress={() => setStep(3)} style={{ flex: 1 }} />
              <Button label="Next: SEO & publish" onPress={() => setStep(5)} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        {isEdit && step === 5 && (
          <Card style={styles.stepCard}>
            <Txt style={styles.stepTitle}>SEO options</Txt>
            <FieldLabel>SEO title</FieldLabel>
            <Input value={seoTitle} onChangeText={setSeoTitle} placeholder={`${title || 'Event'} | ${cityForSeo} tickets`} style={styles.fieldGap} />
            <FieldLabel>Meta description (160 chars)</FieldLabel>
            <Input value={seoDesc} onChangeText={setSeoDesc} maxLength={160} style={styles.fieldGap} />
            <FieldLabel>URL slug</FieldLabel>
            <Input value={seoSlug} onChangeText={setSeoSlug} placeholder={slug} style={styles.fieldGap} />
            <FieldLabel>Keywords (comma-separated)</FieldLabel>
            <Input value={seoKeywords} onChangeText={setSeoKeywords} placeholder="indie concert, hyderabad, live music" style={styles.fieldGap} />

            <Card style={styles.searchPreview}>
              <Muted style={styles.tiny}>Search preview:</Muted>
              <Txt style={styles.searchPreviewTitle}>{seoTitle || `${title || 'Your event'} | ${cityForSeo} tickets`}</Txt>
              <Txt style={styles.searchPreviewUrl}>prebooze.com/events/{slug || 'your-event'}</Txt>
              <Muted style={styles.tiny}>{seoDesc || description.slice(0, 140) || 'Meta description preview…'}</Muted>
            </Card>

            <Accordion title="What happens after submit?">
              Your event goes to admin review (status: Pending). Once approved it's live and bookable. Rejections come back with a reason so you can fix & resubmit.
            </Accordion>

            <View style={styles.navRow}>
              <Button label="Back" variant="ghost" onPress={() => setStep(4)} style={{ flex: 1 }} />
              <Button label="Preview event" disabled={!step1Valid || !tiersValid} onPress={() => setPreview(true)} style={{ flex: 1 }} />
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Txt style={fieldLabelStyle}>{children}</Txt>;
}
function ChipWrap({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipWrap}>{children}</View>;
}

const fieldLabelStyle = { fontSize: fontSize.s, marginBottom: 6, marginTop: spacing.s, color: colors.muted };
const fontStyleSmall = { fontSize: fontSize.s };

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Matches Dashboard's H1 top offset/font size exactly (organizer feedback
  // 2026-09-15: "same top space and font size like dashboard").
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, paddingTop: spacing.l + spacing.s, paddingBottom: spacing.l },
  headerTitle: { flex: 1, fontFamily: fontFamily.extrabold, fontSize: fontSize.display },
  editNoticeWrap: { paddingHorizontal: spacing.l, paddingBottom: spacing.m },
  // alignItems defaults to 'stretch' for a flex row's children — without
  // overriding it, each pill stretches to match the ScrollView's own
  // (sometimes oversized) cross-axis height instead of sizing to its own
  // content, turning them into tall capsules.
  // Without an explicit `style` (only contentContainerStyle) this horizontal
  // ScrollView has no flex opinion of its own, and on Android it can end up
  // sharing the flex column's remaining vertical space 50/50 with the
  // flex:1 content ScrollView below instead of sizing to its pill content
  // (organizer feedback 2026-09-15, "reduce gap between step pills and form
  // fields" — the real cause was a ~1000px stretched ScrollView, not padding).
  stepRowScroll: { flexGrow: 0, flexShrink: 0 },
  stepRow: { gap: spacing.s, paddingHorizontal: spacing.l, paddingBottom: spacing.xs, alignItems: 'flex-start' },
  stepPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: colors.border3, borderRadius: 999, paddingHorizontal: spacing.m, paddingVertical: 7 },
  stepPillOn: { borderColor: colors.accent },
  stepPillLabel: { fontFamily: fontFamily.bold, fontSize: 12.5, color: colors.muted },
  stepPillLabelOn: { color: colors.text },
  // Without flex:1 here, a short step's content (e.g. create-mode's
  // Line-up, the last/shortest step) leaves "spare" vertical space in the
  // column that Yoga hands to the stepRow ScrollView above instead of
  // just trailing blank space below — stretching the step pills into tall
  // capsules. Giving this ScrollView the flex claims that space itself.
  contentScroll: { flex: 1 },
  content: { padding: spacing.l, paddingTop: 0, paddingBottom: spacing.xxl },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.s },
  stepCard: { padding: spacing.l },
  stepTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.l, marginBottom: spacing.s, marginTop: spacing.s },
  fieldGap: { marginBottom: spacing.s },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  // No marginBottom here — every chip row is followed either by a
  // FieldLabel (which already has its own marginTop) or an element with
  // its own explicit top margin, so a marginBottom here was stacking with
  // that into a visibly bigger gap than anywhere else in the form.
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  chipRow: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.s, flexWrap: 'wrap' },
  row3: { flexDirection: 'row', gap: spacing.s, alignItems: 'flex-start' },
  rowAlignEnd: { alignItems: 'flex-end' },
  flex1: { flex: 1 },
  navRow: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.l },
  tierCard: { backgroundColor: colors.surface2, marginBottom: spacing.m, padding: spacing.m },
  // Qty's column includes a FieldLabel above the Input, so the row's
  // flex-end alignment lands the button below the input's true bottom
  // edge by exactly the input's own bottom margin (fieldGap) — pull it
  // back up by that same amount, and match the input's ~45px height so
  // the two boxes read as a matched pair.
  tierRemoveBtn: { marginBottom: spacing.s, width: 45, height: 45 },
  pickerField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface2, borderColor: colors.border3, borderWidth: 1, borderRadius: radius.m,
    paddingHorizontal: spacing.l, paddingVertical: spacing.m,
  },
  customIncludeRow: { flexDirection: 'row', gap: spacing.s, alignItems: 'center', marginTop: spacing.s },
  customIncludeInput: { flex: 1 },
  ruleRow: { flexDirection: 'row', gap: spacing.s, alignItems: 'flex-start', marginBottom: spacing.s },
  enableBox: { borderWidth: 1.5, borderColor: colors.border3, borderRadius: radius.m, padding: spacing.m, marginBottom: spacing.m },
  promoterBox: { borderWidth: 1.5, borderColor: colors.border3, borderRadius: radius.m, padding: spacing.m, marginBottom: spacing.s },
  promoterOptions: { marginTop: spacing.s, marginLeft: 30, gap: spacing.s },
  promoterOptRow: {},
  iconLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  revenueShareRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 30 },
  revenueShareInput: { width: 70, paddingVertical: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.m },
  perHeadField: { marginLeft: 30, maxWidth: 200 },
  searchPreview: { backgroundColor: colors.surface2, padding: spacing.m, marginBottom: spacing.m },
  searchPreviewTitle: { color: '#8ab4f8', fontSize: fontSize.l, fontFamily: fontFamily.medium, marginVertical: 2 },
  searchPreviewUrl: { color: '#4fd394', fontSize: 12, marginBottom: 4 },
  tiny: { fontSize: 11.5 },
  galleryUseBtn: { alignSelf: 'flex-start', marginBottom: spacing.s, height: 36, paddingHorizontal: spacing.m },
  galleryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s, marginBottom: spacing.s },
  galleryThumbWrap: {},
  galleryAddTile: { width: 72, height: 96, borderRadius: radius.m, borderWidth: 1.5, borderColor: colors.border3, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  previewCard: { padding: spacing.l, marginBottom: spacing.m },
  previewTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xxl, marginBottom: spacing.xs },
  previewDesc: { fontSize: fontSize.s, marginTop: spacing.m, lineHeight: 20 },
  footerNote: { fontSize: 11 },
});
