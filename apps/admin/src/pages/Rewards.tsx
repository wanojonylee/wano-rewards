import React, { useState } from 'react';
import { Plus, RefreshCcw } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { brl, num } from '../lib/format';
import { Badge, Button, Card, Field, Loading, Modal, useToast } from '../components/ui';
import type { Reward } from '../lib/types';

const emptyReward = (): Reward => ({
  id: `rwd_new_${Date.now()}`,
  title: '',
  subtitle: '',
  category: 'voucher',
  partner: '',
  pointsCost: 500,
  valueCents: 1500,
  imageKey: 'coffee',
  stock: 20,
  active: true,
  terms: '',
});

const IMAGE_KEYS = [
  'coffee',
  'market',
  'cinema',
  'transit',
  'gym',
  'donation',
  'bag',
  'plant',
  'ticket',
  'streaming',
  'bottle',
  'bookstore',
  'icecream',
  'bike',
];

const CATEGORIES: Array<Reward['category']> = ['voucher', 'product', 'experience', 'donation'];

export function Rewards() {
  const { t, locale } = useI18n();
  const rewards = useAsync(() => api.rewards(), [locale]);
  const { show } = useToast();
  const [editing, setEditing] = useState<Reward | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.partner.trim()) {
      show(t('rewards.toastNeedFields'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.saveReward(editing);
      show(t('rewards.toastSaved'));
      setEditing(null);
      rewards.reload();
    } catch (error) {
      show(error instanceof Error ? error.message : t('rewards.toastError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('rewards.eyebrow')}</div>
          <h1>{t('rewards.title')}</h1>
          <p>{t('rewards.subtitle')}</p>
        </div>
        <div className="actions">
          <Button variant="secondary" onClick={() => rewards.reload()}>
            <RefreshCcw size={15} /> {t('common.refresh')}
          </Button>
          <Button onClick={() => setEditing(emptyReward())}>
            <Plus size={15} /> {t('rewards.new')}
          </Button>
        </div>
      </div>

      <Card>
        {rewards.loading ? (
          <Loading />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('rewards.colReward')}</th>
                  <th>{t('rewards.colCategory')}</th>
                  <th>{t('rewards.colPartner')}</th>
                  <th>{t('rewards.colPoints')}</th>
                  <th>{t('rewards.colValue')}</th>
                  <th>{t('rewards.colStock')}</th>
                  <th>{t('rewards.colStatus')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(rewards.data ?? []).map((reward) => (
                  <tr key={reward.id}>
                    <td>
                      <div className="table__main">{reward.title}</div>
                      <div className="table__sub">{reward.subtitle}</div>
                    </td>
                    <td>
                      <Badge tone="grey">{t(`category.${reward.category}`, undefined, reward.category)}</Badge>
                    </td>
                    <td>{reward.partner}</td>
                    <td className="table__num">{num(reward.pointsCost)}</td>
                    <td className="table__num">{brl(reward.valueCents)}</td>
                    <td>
                      {reward.stock > 50 ? <Badge tone="green">{reward.stock}</Badge> : reward.stock > 0 ? <Badge tone="amber">{reward.stock}</Badge> : <Badge tone="red">0</Badge>}
                    </td>
                    <td>
                      <Badge tone={reward.active === false ? 'grey' : 'green'} dot>
                        {reward.active === false ? t('status.inactive') : t('status.active')}
                      </Badge>
                    </td>
                    <td>
                      <div className="table__actions">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(reward)}>
                          {t('common.edit')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!editing}
        title={editing?.id.startsWith('rwd_new') ? t('rewards.newTitle') : t('rewards.editTitle')}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? t('common.saving') : t('rewards.save')}
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="form-grid">
            <Field label={t('rewards.fieldTitle')}>
              <input className="input" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
            </Field>
            <Field label={t('rewards.fieldPartner')}>
              <input className="input" value={editing.partner} onChange={(event) => setEditing({ ...editing, partner: event.target.value })} />
            </Field>
            <Field label={t('rewards.fieldSubtitle')} full>
              <input className="input" value={editing.subtitle} onChange={(event) => setEditing({ ...editing, subtitle: event.target.value })} />
            </Field>
            <Field label={t('rewards.fieldCategory')}>
              <select
                className="select"
                value={editing.category}
                onChange={(event) => setEditing({ ...editing, category: event.target.value as Reward['category'] })}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`category.${category}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('rewards.fieldPoints')}>
              <input
                className="input"
                type="number"
                min="1"
                value={editing.pointsCost}
                onChange={(event) => setEditing({ ...editing, pointsCost: Number(event.target.value) })}
              />
            </Field>
            <Field label={t('rewards.fieldValue')}>
              <input
                className="input"
                type="number"
                min="0"
                value={editing.valueCents}
                onChange={(event) => setEditing({ ...editing, valueCents: Number(event.target.value) })}
              />
            </Field>
            <Field label={t('rewards.fieldStock')}>
              <input
                className="input"
                type="number"
                min="0"
                value={editing.stock}
                onChange={(event) => setEditing({ ...editing, stock: Number(event.target.value) })}
              />
            </Field>
            <Field label={t('rewards.fieldImage')}>
              <select className="select" value={editing.imageKey} onChange={(event) => setEditing({ ...editing, imageKey: event.target.value })}>
                {IMAGE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(`image.${key}`, undefined, key)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('rewards.fieldStatus')}>
              <select className="select" value={editing.active === false ? 'false' : 'true'} onChange={(event) => setEditing({ ...editing, active: event.target.value === 'true' })}>
                <option value="true">{t('status.active')}</option>
                <option value="false">{t('status.inactive')}</option>
              </select>
            </Field>
            <Field label={t('rewards.fieldTerms')} full>
              <textarea className="textarea" value={editing.terms} onChange={(event) => setEditing({ ...editing, terms: event.target.value })} />
            </Field>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
