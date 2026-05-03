"use client";

import React, { useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Target } from "lucide-react";

// Statik Veriler
const agents = [
  { name: "Alex", leadsToBeContacted: 91, calls: 90, trend: "up" },
  { name: "Bob", leadsToBeContacted: 106, calls: 105, trend: "up" },
  { name: "Cindy", leadsToBeContacted: 112, calls: 110, trend: "up" },
  { name: "Dana", leadsToBeContacted: 91, calls: 90, trend: "stable" },
  { name: "Eric", leadsToBeContacted: 106, calls: 90, trend: "down" },
  { name: "Janet", leadsToBeContacted: 109, calls: 90, trend: "stable" },
];

const teamData = [
  { team: "ALEXANDRA", members: ["CANER ARSAL", "DAMLA TÜRKAY", "KÜBRA EKMEKÇİ", "MAVİCAN TEKUZ"] },
  { team: "DİLARA", members: ["GÜNEY GÖÇ", "FURKAN KIRIK", "SOUFİANE SLİMANE"] },
  { team: "KAROLİNA", members: ["BURAK SOYDAN", "LİVİA GOGA", "MİRAY İPEK"] },
  { team: "MEHMET", members: ["BERFİN AYDOĞDU", "DENİZ ŞENAVCI", "DİDEM ÖZBEK", "EMİR ÖZDEMİR", "İBRAHİM ŞIK", "OĞUZHAN BERK", "UĞUR BAŞ"] },
  { team: "TEAM LEADERS", members: ["ALEXANDRA BOYKO", "DİLARA KENT", "KAROLİNA EWA PAWLİSZAK", "MEHMET AKGÜL"] },
];

const conversionFunnelData = [
  { name: "CANER ARSAL", team: "ALEXANDRA", secondCall: 12, secondCallTarget: 15, secondContact: 8, deposit: 5 },
  { name: "GÜNEY GÖÇ", team: "DİLARA", secondCall: 18, secondCallTarget: 20, secondContact: 12, deposit: 9 },
  { name: "EMİR ÖZDEMİR", team: "MEHMET", secondCall: 8, secondCallTarget: 12, secondContact: 5, deposit: 1 },
  { name: "MEHMET AKGÜL", team: "TEAM LEADERS", secondCall: 25, secondCallTarget: 26, secondContact: 19, deposit: 13 },
];

export default function WeeklyReport() {
  const [selectedTeam, setSelectedTeam] = useState("all");

  const filteredData = selectedTeam === "all" 
    ? conversionFunnelData 
    : conversionFunnelData.filter(c => c.team === selectedTeam);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 1. Agent Performans Tablosu */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800"><h3 className="font-bold">Agent Performans Özeti</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-6 py-4">Agent</th>
                <th className="px-6 py-4 text-right">Hedeflenen</th>
                <th className="px-6 py-4 text-right">Aranan</th>
                <th className="px-6 py-4 text-right">Durum</th>
                <th className="px-6 py-4 text-center">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {agents.map(agent => (
                <tr key={agent.name} className="hover:bg-zinc-800/30">
                  <td className="px-6 py-4 font-bold text-zinc-200">{agent.name}</td>
                  <td className="px-6 py-4 text-right text-zinc-400">{agent.leadsToBeContacted}</td>
                  <td className="px-6 py-4 text-right text-zinc-400">{agent.calls}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold border ${agent.leadsToBeContacted - agent.calls === 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                      {agent.leadsToBeContacted - agent.calls === 0 ? 'Excellent' : 'Warning'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {agent.trend === "up" ? <TrendingUp className="inline w-4 h-4 text-emerald-500" /> : <TrendingDown className="inline w-4 h-4 text-red-500" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Dönüşüm Hunisi */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2"><Target className="w-4 h-4 text-blue-500"/> Dönüşüm Hunisi</h3>
          <select 
            value={selectedTeam} 
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="bg-black border border-zinc-700 text-xs rounded-lg px-3 py-1.5 outline-none"
          >
            <option value="all">Tüm Takımlar</option>
            {teamData.map(t => <option key={t.team} value={t.team}>{t.team}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-950 text-zinc-500 uppercase text-[10px]">
              <tr>
                <th className="px-6 py-4">Danışman</th>
                <th className="px-6 py-4 text-center">Target %</th>
                <th className="px-6 py-4 text-center">Call → SC</th>
                <th className="px-6 py-4 text-center">SC → Sale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredData.map(c => (
                <tr key={c.name} className="hover:bg-zinc-800/30 text-xs">
                  <td className="px-6 py-4 font-bold text-zinc-300">{c.name}</td>
                  <td className="px-6 py-4 text-center text-blue-400 font-medium">{((c.secondCall/c.secondCallTarget)*100).toFixed(1)}%</td>
                  <td className="px-6 py-4 text-center text-emerald-400">{((c.secondContact/c.secondCall)*100).toFixed(1)}%</td>
                  <td className="px-6 py-4 text-center font-bold text-zinc-100">{((c.deposit/c.secondContact)*100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}