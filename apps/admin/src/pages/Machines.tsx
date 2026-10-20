import React, { useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { useI18n } from '../lib/i18n';
import { Badge, Button, Card, Field, Loading, Modal, Progress, useToast } from '../components/ui';
import type { Machine } from '../lib/types';

export function Machines() {
  const { t, locale } = useI18n();
  const machines = useAsync(() => api.machines(), [locale]);
  const { show } = useToast();
  const [editing, setEditing] = useState<Machine | null>(null);
  const [level, setLevel] = useState(50);
  const [saving, setSaving] = useState(false);

  const statusBadge = (status: Machine['status']) => {
    if (status === 'online') return <Badge tone="green" dot>{t('status.online')}</Badge>;
    if (status === 'full') return <Badge tone="amber" dot>{t('status.full')}</Badge>;
    return <Badge tone="red" dot>{t('status.maintenance')}</Badge>;
  };

  const materialLabel = (value: string) => t(`material.${value}`, undefined, value);

  const open = (machine: Machine) => {
    setEditing(machine);
    setLevel(machine.fillPercent);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.setBoxLevel(editing.code, level);
      show(t('machines.toastUpdated', { code: editing.code, level }));
      setEditing(null);
      machines.reload();
    } catch (error) {
      show(error instanceof Error ? error.message : t('machines.toastError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const rows = machines.data ?? [];
  const online = rows.filter((machine) => machine.status === 'online').length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('machines.eyebrow')}</div>
          <h1>{t('machines.title')}</h1>
          <p>{t('machines.subtitle')}</p>
        </div>
        <div className="actions">
          <Badge tone="green">{t('machines.onlineCount', { online, total: rows.length })}</Badge>
          <Button variant="secondary" onClick={() => machines.reload()}>
            <RefreshCcw size={15} /> {t('common.refresh')}
          </Button>
        </div>
      </div>

      <Card>
        {machines.loading ? (
          <Loading />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('machines.colMachine')}</th>
                  <th>{t('machines.colLocation')}</th>
                  <th>{t('machines.colStatus')}</th>
                  <th>{t('machines.colOccupancy')}</th>
                  <th>{t('machines.colMaterials')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((machine) => (
                  <tr key={machine.id}>
                    <td>
                      <div className="table__main">{machine.code}</div>
                      <div className="table__sub">{machine.name}</div>
                    </td>
                    <td>
                      <div>{machine.address}</div>
                      <div className="table__sub">{machine.hours}</div>
                    </td>
                    <td>{statusBadge(machine.status)}</td>
                    <td style={{ minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ flex: 1 }}>
                          <Progress value={machine.fillPercent} />
                        </div>
                        <span className="table__num">{machine.fillPercent}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="table__sub">{machine.materials.map(materialLabel).join(' · ')}</div>
                    </td>
                    <td>
                      <div className="table__actions">
                        <Button size="sm" variant="secondary" onClick={() => open(machine)}>
                          {t('machines.updateLevel')}
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
        title={editing ? t('machines.occupancy', { code: editing.code }) : t('machines.occupancyTitle')}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? t('common.saving') : t('machines.saveLevel')}
            </Button>
          </>
        }
      >
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label={t('machines.fieldLevel', { level })}>
              <input
                type="range"
                min={0}
                max={100}
                value={level}
                onChange={(event) => setLevel(Number(event.target.value))}
                style={{ width: '100%' }}
              />
            </Field>
            <Progress value={level} />
            <div className="note">{t('machines.note')}</div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
