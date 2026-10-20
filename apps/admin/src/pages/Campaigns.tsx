import React, { useState } from 'react';
import { Plus, RefreshCcw } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { date } from '../lib/format';
import { Badge, Button, Card, Field, Loading, Modal, useToast } from '../components/ui';
import type { Campaign } from '../lib/types';

const emptyCampaign = (): Campaign => ({
  id: `cmp_new_${Date.now()}`,
  title: '',
  brand: 'WANO',
  subtitle: '',
  material: 'PET',
  multiplier: 2,
  bonusPoints: 0,
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  imageKey: 'bottle',
  accent: '#3E8E7E',
  active: true,
});

const toDateInput = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const fromDateInput = (value: string) => new Date(`${value}T12:00:00.000Z`).toISOString();

const IMAGE_KEYS = ['bottle', 'plant', 'bike', 'streaming', 'ticket', 'coffee', 'market', 'bag'];

export function Campaigns() {
  const { t, locale } = useI18n();
  const campaigns = useAsync(() => api.campaigns(), [locale]);
  const { show } = useToast();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);

  const materialLabel = (value: string) => t(`material.${value}`, undefined, value);

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.brand.trim()) {
      show(t('campaigns.toastNeedFields'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.saveCampaign(editing);
      show(t('campaigns.toastSaved'));
      setEditing(null);
      campaigns.reload();
    } catch (error) {
      show(error instanceof Error ? error.message : t('campaigns.toastError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('campaigns.eyebrow')}</div>
          <h1>{t('campaigns.title')}</h1>
          <p>{t('campaigns.subtitle')}</p>
        </div>
        <div className="actions">
          <Button variant="secondary" onClick={() => campaigns.reload()}>
            <RefreshCcw size={15} /> {t('common.refresh')}
          </Button>
          <Button onClick={() => setEditing(emptyCampaign())}>
            <Plus size={15} /> {t('campaigns.new')}
          </Button>
        </div>
      </div>

      {campaigns.loading ? (
        <Loading />
      ) : (
        <div className="grid-2--even grid-2">
          {(campaigns.data ?? []).map((campaign) => (
            <Card key={campaign.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>
                    {campaign.brand}
                  </div>
                  <div className="card__title" style={{ fontSize: 19 }}>
                    {campaign.title}
                  </div>
                  <div className="card__hint" style={{ marginTop: 4 }}>
                    {campaign.subtitle}
                  </div>
                </div>
                <Badge tone={campaign.active === false ? 'grey' : 'green'} dot>
                  {campaign.active === false ? t('campaigns.paused') : t('campaigns.statusActive')}
                </Badge>
              </div>
              <div className="split" style={{ marginTop: 18 }}>
                <div className="split__item">
                  <div className="split__label">{t('campaigns.mechanic')}</div>
                  <div className="split__value" style={{ fontSize: 22 }}>
                    {campaign.multiplier > 1
                      ? t('campaigns.multiplier', { value: campaign.multiplier })
                      : t('campaigns.bonus', { value: campaign.bonusPoints })}
                  </div>
                </div>
                <div className="split__item">
                  <div className="split__label">{t('campaigns.period')}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                    {date(campaign.startsAt)} → {date(campaign.endsAt)}
                  </div>
                </div>
                <div className="split__item">
                  <div className="split__label">{t('campaigns.material')}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                    {campaign.material ? materialLabel(campaign.material) : t('common.all')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <Button size="sm" variant="secondary" onClick={() => setEditing(campaign)}>
                  {t('common.edit')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        title={editing?.id.startsWith('cmp_new') ? t('campaigns.newTitle') : t('campaigns.editTitle')}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? t('common.saving') : t('campaigns.save')}
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="form-grid">
            <Field label={t('campaigns.fieldTitle')}>
              <input className="input" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
            </Field>
            <Field label={t('campaigns.fieldBrand')}>
              <input className="input" value={editing.brand} onChange={(event) => setEditing({ ...editing, brand: event.target.value })} />
            </Field>
            <Field label={t('campaigns.fieldSubtitle')} full>
              <input className="input" value={editing.subtitle} onChange={(event) => setEditing({ ...editing, subtitle: event.target.value })} />
            </Field>
            <Field label={t('campaigns.fieldMaterial')}>
              <select className="select" value={editing.material ?? ''} onChange={(event) => setEditing({ ...editing, material: event.target.value || null })}>
                <option value="">{t('common.all')}</option>
                {['PET', 'ALUMINUM', 'GLASS', 'HDPE', 'PP', 'PS_HIPS'].map((material) => (
                  <option key={material} value={material}>
                    {materialLabel(material)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('campaigns.fieldMultiplier')}>
              <input
                className="input"
                type="number"
                step="0.1"
                min="1"
                value={editing.multiplier}
                onChange={(event) => setEditing({ ...editing, multiplier: Number(event.target.value) })}
              />
            </Field>
            <Field label={t('campaigns.fieldBonus')}>
              <input
                className="input"
                type="number"
                min="0"
                value={editing.bonusPoints}
                onChange={(event) => setEditing({ ...editing, bonusPoints: Number(event.target.value) })}
              />
            </Field>
            <Field label={t('campaigns.fieldStart')}>
              <input className="input" type="date" value={toDateInput(editing.startsAt)} onChange={(event) => setEditing({ ...editing, startsAt: fromDateInput(event.target.value) })} />
            </Field>
            <Field label={t('campaigns.fieldEnd')}>
              <input className="input" type="date" value={toDateInput(editing.endsAt)} onChange={(event) => setEditing({ ...editing, endsAt: fromDateInput(event.target.value) })} />
            </Field>
            <Field label={t('campaigns.fieldImage')}>
              <select className="select" value={editing.imageKey} onChange={(event) => setEditing({ ...editing, imageKey: event.target.value })}>
                {IMAGE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(`image.${key}`, undefined, key)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('campaigns.fieldAccent')}>
              <input className="input" type="color" value={editing.accent} onChange={(event) => setEditing({ ...editing, accent: event.target.value })} />
            </Field>
            <Field label={t('campaigns.fieldStatus')}>
              <select className="select" value={editing.active === false ? 'false' : 'true'} onChange={(event) => setEditing({ ...editing, active: event.target.value === 'true' })}>
                <option value="true">{t('campaigns.statusActive')}</option>
                <option value="false">{t('campaigns.statusPaused')}</option>
              </select>
            </Field>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
