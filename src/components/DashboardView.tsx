'use client';

import { useEffect, useState } from 'react';
import type { ConversationSummary } from '@/lib/types';

type Stage = 'needs-call' | 'meeting-booked' | 'closed-dead';
interface PipelineLead { id: string; stage: Stage; }

const STORAGE_KEY = 'pipeline_leads_v1';

function loadPipelineLeads(): PipelineLead[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
}

function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className="dv-card" style={{ borderColor: accent ? accent + '33' : undefined }}>
      {accent && <div className="dv-card-bar" style={{ background: accent }} />}
      <div className="dv-card-value">{value}</div>
      <div className="dv-card-label">{label}</div>
      {sub && <div className="dv-card-sub">{sub}</div>}
    </div>
  );
}

export function DashboardView({ conversations }: { conversations: ConversationSummary[] }) {
  const [pipelineLeads, setPipelineLeads] = useState<PipelineLead[]>([]);

  useEffect(() => {
    setPipelineLeads(loadPipelineLeads());
  }, []);

  const totalLeads = conversations.length;
  const hotLeads = conversations.filter(c => (c.responseType || '').trim().toLowerCase() === 'highly interested').length;
  const needsResponse = conversations.filter(c => c.needsResponse).length;
  const activeLeads = conversations.filter(c => c.workflowStatus === 'active').length;
  const dncLeads = conversations.filter(c => c.workflowStatus === 'dnc').length;

  const pipelineNeedsCall = pipelineLeads.filter(l => l.stage === 'needs-call').length;
  const pipelineBooked = pipelineLeads.filter(l => l.stage === 'meeting-booked').length;
  const pipelineClosed = pipelineLeads.filter(l => l.stage === 'closed-dead').length;

  return (
    <div className="dv-root">
      <style>{`
        .dv-root { padding: 20px; }
        .dv-section-title {
          font-size: 11px;
          font-weight: 700;
          color: #7a7a8a;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0 0 12px;
        }
        .dv-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 28px;
        }
        .dv-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 18px 16px 14px;
          position: relative;
          overflow: hidden;
          transition: border-color 0.2s;
        }
        .dv-card:hover { border-color: rgba(255,255,255,0.12); }
        .dv-card-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          border-radius: 14px 14px 0 0;
          opacity: 0.8;
        }
        .dv-card-value {
          font-size: 32px;
          font-weight: 800;
          color: #e8e8e7;
          line-height: 1;
          margin-bottom: 6px;
        }
        .dv-card-label {
          font-size: 12px;
          font-weight: 600;
          color: #7a7a8a;
        }
        .dv-card-sub {
          font-size: 11px;
          color: #4b5563;
          margin-top: 3px;
        }
        .dv-welcome {
          background: rgba(139,92,246,0.07);
          border: 1px solid rgba(139,92,246,0.18);
          border-radius: 16px;
          padding: 20px 22px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .dv-welcome-text {
          font-size: 15px;
          font-weight: 700;
          color: #e8e8e7;
          margin: 0 0 4px;
        }
        .dv-welcome-sub {
          font-size: 12px;
          color: #7a7a8a;
          margin: 0;
        }
        .dv-welcome-badge {
          background: linear-gradient(90deg, #8b5cf6, #60a5fa);
          border-radius: 10px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 700;
          color: #fff;
          white-space: nowrap;
          flex-shrink: 0;
        }
        @media (max-width: 600px) {
          .dv-grid { grid-template-columns: 1fr 1fr; }
          .dv-welcome { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="dv-welcome">
        <div>
          <p className="dv-welcome-text">Welcome back, Henry 👋</p>
          <p className="dv-welcome-sub">Here's what's going on with your leads today.</p>
        </div>
        <div className="dv-welcome-badge">Scalia CRM</div>
      </div>

      <p className="dv-section-title">Inbox Overview</p>
      <div className="dv-grid">
        <StatCard label="Total leads" value={totalLeads} accent="#8b5cf6" />
        <StatCard label="Hot leads" value={hotLeads} accent="#22c55e" sub="Highly interested" />
        <StatCard label="Needs response" value={needsResponse} accent="#f59e0b" />
        <StatCard label="Active" value={activeLeads} accent="#60a5fa" />
        <StatCard label="DNC" value={dncLeads} accent="#ef4444" />
      </div>

      <p className="dv-section-title">Pipeline</p>
      <div className="dv-grid">
        <StatCard label="Needs a Call" value={pipelineNeedsCall} accent="#a78bfa" />
        <StatCard label="Meeting Booked" value={pipelineBooked} accent="#60a5fa" />
        <StatCard label="Closed / Dead" value={pipelineClosed} accent="#4b5563" />
      </div>
    </div>
  );
}
