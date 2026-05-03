"use client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, AlertTriangle, Trophy, PhoneCall, Download, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useRef } from "react";
import html2pdf from "html2pdf.js";

const consultantPerformance = [
  { name: "Melike Alara Bulut", calls: 10, healthScore: 65.5 },
  { name: "Nurhan Güney", calls: 9, healthScore: 66.1 },
  { name: "Alexandra Boyko", calls: 6, healthScore: 75.0 },
  { name: "Livia Goga", calls: 6, healthScore: 62.5 },
  { name: "Mavican Tekuz", calls: 5, healthScore: 63.0 },
  { name: "Damla Türkay", calls: 5, healthScore: 71.0 },
  { name: "İbrahim Şık", calls: 3, healthScore: 81.6 },
  { name: "Mehmet Akgül", calls: 3, healthScore: 75.0 },
  { name: "Didem Özbek", calls: 3, healthScore: 50.0 },
  { name: "Güney Göç", calls: 2, healthScore: 85.0 },
  { name: "Miray İpek", calls: 2, healthScore: 70.0 },
  { name: "Furkan Kırık", calls: 2, healthScore: 65.0 },
  { name: "Emir Özdemir", calls: 2, healthScore: 30.0 },
  { name: "Deniz Şenavcı", calls: 1, healthScore: 75.0 },
  { name: "Sinem Bulur", calls: 3, healthScore: 75.0 },
];

const dailyCallBreakdown = [
  { date: "14 Şubat", secondCall: 2, firstCall: 6 },
  { date: "15 Şubat", secondCall: 1, firstCall: 8 },
  { date: "16 Şubat", secondCall: 3, firstCall: 18 },
  { date: "17 Şubat", secondCall: 3, firstCall: 7 },
  { date: "18 Şubat", secondCall: 2, firstCall: 9 },
  { date: "19 Şubat", secondCall: 3, firstCall: 7 },
  { date: "20 Şubat", secondCall: 3, firstCall: 7 },
];

const callDurations = [
  { name: "Miray İpek", calls: 9, totalDuration: "180:44", avgDuration: "20:04" },
  { name: "Soufiane Hadj Slimane", calls: 8, totalDuration: "82:16", avgDuration: "10:17" },
  { name: "Güney Göç", calls: 6, totalDuration: "51:47", avgDuration: "08:37" },
  { name: "Alexandra Boyko", calls: 6, totalDuration: "44:34", avgDuration: "07:25" },
  { name: "Didem Özbek", calls: 3, totalDuration: "40:06", avgDuration: "13:22" },
  { name: "İbrahim Şık (Jason)", calls: 3, totalDuration: "34:35", avgDuration: "11:31" },
  { name: "Karolina Pawlizsak", calls: 2, totalDuration: "31:10", avgDuration: "15:35" },
  { name: "Mavican Tekuz", calls: 2, totalDuration: "27:24", avgDuration: "13:42" },
  { name: "Dilara Kent", calls: 2, totalDuration: "11:52", avgDuration: "05:56" },
  { name: "Melike Alara Bulut", calls: 2, totalDuration: "08:16", avgDuration: "04:08" },
  { name: "Sinem Bulur", calls: 2, totalDuration: "04:34", avgDuration: "02:17" },
  { name: "Ahsen Tutar", calls: 4, totalDuration: "56:41", avgDuration: "14:10" },
  { name: "Damla Türkay", calls: 4, totalDuration: "90:41", avgDuration: "22:40" },
  { name: "Caner Arsal (Kevin)", calls: 1, totalDuration: "32:25", avgDuration: "32:25" },
  { name: "Berfin Aydoğdu", calls: 1, totalDuration: "25:31", avgDuration: "25:31" },
  { name: "Livia Goga", calls: 1, totalDuration: "10:41", avgDuration: "10:41" },
];

const packageGaps: { name: string; missingPackages: string; count: number }[] = [];

const consultantCallDistribution = [
  { name: "Miray İpek", totalCalls: 9, firstCall: 0, secondCall: 9 },
  { name: "Soufiane Hadj Slimane", totalCalls: 8, firstCall: 0, secondCall: 8 },
  { name: "Güney Göç", totalCalls: 6, firstCall: 0, secondCall: 6 },
  { name: "Alexandra Boyko", totalCalls: 6, firstCall: 3, secondCall: 3 },
  { name: "Ahsen Tutar", totalCalls: 4, firstCall: 0, secondCall: 4 },
  { name: "Damla Türkay", totalCalls: 4, firstCall: 0, secondCall: 4 },
  { name: "Didem Özbek", totalCalls: 3, firstCall: 0, secondCall: 3 },
  { name: "İbrahim Şık (Jason)", totalCalls: 3, firstCall: 0, secondCall: 3 },
  { name: "Karolina Pawlizsak", totalCalls: 2, firstCall: 0, secondCall: 2 },
  { name: "Mavican Tekuz", totalCalls: 2, firstCall: 1, secondCall: 1 },
  { name: "Dilara Kent", totalCalls: 2, firstCall: 0, secondCall: 2 },
  { name: "Melike Alara Bulut", totalCalls: 2, firstCall: 1, secondCall: 1 },
  { name: "Sinem Bulur", totalCalls: 2, firstCall: 1, secondCall: 1 },
  { name: "Caner Arsal (Kevin)", totalCalls: 1, firstCall: 0, secondCall: 1 },
  { name: "Berfin Aydoğdu", totalCalls: 1, firstCall: 0, secondCall: 1 },
  { name: "Livia Goga", totalCalls: 1, firstCall: 0, secondCall: 1 },
];

const unlistenedConsultants = [
  { name: "Kübra Ekmekçi", team: "Alexandra" },
  { name: "Emir Özdemir", team: "Mehmet" },
  { name: "Oğuzhan Berk", team: "Mehmet" },
  { name: "Uğur Baş", team: "Mehmet" },
  { name: "Tuğçe Yücelirgil", team: "Dilara" },
  { name: "Mehmet Akgül", team: "TL" },
];

// Team mapping for consultants
const consultantTeamMapping: Record<string, string> = {
  "Caner Arsal": "Alexandra",
  "Damla Türkay": "Alexandra",
  "Kübra Ekmekçi": "Alexandra",
  "Mavican Tekuz": "Alexandra",
  "Melike Alara Bulut": "Alexandra",
  "Yurdagül Esen": "Alexandra",
  "Güney Göç": "Dilara",
  "M.Soufiane Hadj Slimane": "Dilara",
  "Nurhan Güney": "Dilara",
  "Sinem Bulur": "Dilara",
  "Tuğçe Yücelirgül": "Dilara",
  "Furkan Kırık": "Dilara",
  "Burak Soydan": "Karolina",
  "Livia Goga": "Karolina",
  "Miray İpek": "Karolina",
  "Berfin Aydoğdu": "Mehmet",
  "Deniz Şenavcı": "Mehmet",
  "Didem Özbek": "Mehmet",
  "Emir Özdemir": "Mehmet",
  "İbrahim Şık": "Mehmet",
  "Oğuzhan Berk": "Mehmet",
  "Uğur Baş": "Mehmet",
  "Alexandra Boyko": "Team Leader",
  "Dilara Kent": "Team Leader",
  "Karolina Ewa Pawliszak": "Team Leader",
  "Mehmet Akgül": "Team Leader",
};

// Team-based call distribution
const teamDistribution = [
  { team: "Dilara'nın Takımı", totalCalls: 16, firstCall: 1, secondCall: 15 },
  { team: "Karolina'nın Takımı", totalCalls: 14, firstCall: 0, secondCall: 14 },
  { team: "Takım Liderleri (TL)", totalCalls: 10, firstCall: 3, secondCall: 7 },
  { team: "Mehmet'in Takımı", totalCalls: 7, firstCall: 0, secondCall: 7 },
  { team: "Alexandra'nın Takımı", totalCalls: 9, firstCall: 2, secondCall: 7 },
];

const WeeklyEvaluationReport = () => {
  const reportRef = useRef<HTMLDivElement>(null);

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 70) return "text-primary";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getHealthScoreBadge = (score: number) => {
    if (score >= 80) return { label: "Mükemmel", variant: "default" as const, className: "bg-success" };
    if (score >= 70) return { label: "İyi", variant: "default" as const, className: "bg-primary" };
    if (score >= 60) return { label: "Orta", variant: "default" as const, className: "bg-warning" };
    return { label: "Gelişmeli", variant: "destructive" as const };
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    const html2pdf = (await import("html2pdf.js" as any)).default;
    const opt = {
      margin: [10, 15, 10, 15],
      filename: "haftalik-degerlendirme-raporu.pdf",
      image: { type: "png", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] }
    };
    html2pdf().set(opt).from(reportRef.current).save();
  };

  return (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={handleExportPDF} className="gap-2">
          <Download className="h-4 w-4" />
          PDF İndir
        </Button>
      </div>

      <div ref={reportRef} className="space-y-6">
      {/* Summary Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Toplam Değerlendirme</p>
              <h3 className="text-3xl font-bold mt-2">105</h3>
              <p className="text-xs text-muted-foreground mt-1">Çağrı Analiz Edildi</p>
            </div>
            <PhoneCall className="h-10 w-10 text-primary" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Second Call</p>
              <h3 className="text-3xl font-bold mt-2">50</h3>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-success" />
                <p className="text-xs text-success">+11 geçen haftaya göre</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">2 dakika ve üzeri çağrı sayısı</p>
              <h3 className="text-3xl font-bold mt-2">55</h3>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-success" />
                <p className="text-xs text-success">+10 geçen haftaya göre</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">2 dakika'dan az First Call Çağrı Sayısı</p>
              <h3 className="text-3xl font-bold mt-2 text-warning">93</h3>
              <p className="text-xs text-muted-foreground mt-1">Çağrı</p>
            </div>
            <Clock className="h-10 w-10 text-warning" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Yüksek Potansiyel</p>
              <h3 className="text-3xl font-bold mt-2 text-success">2</h3>
              <p className="text-xs text-muted-foreground mt-1">Çağrı</p>
            </div>
            <Trophy className="h-10 w-10 text-success" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Kayıp Riski</p>
              <h3 className="text-3xl font-bold mt-2 text-destructive">2</h3>
              <p className="text-xs text-muted-foreground mt-1">Çağrı</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">Müşterinin başka kliniklerden quote alması</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Competitor Mentions */}
      <Card className="p-6 bg-muted/50 border-muted">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-warning" />
          <div>
            <p className="font-semibold text-warning">Rakip İsmi Geçen Çağrı</p>
            <p className="text-sm text-muted-foreground">Bu hafta 1 çağrıda rakip firma bahsedildi</p>
          </div>
          <Badge variant="outline" className="ml-auto bg-warning/10 text-warning text-lg px-4 py-1">
            1
          </Badge>
        </div>
      </Card>

      {/* SDR Calls */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">SDR Calls</h2>
        <p className="text-sm text-muted-foreground">8 Mart - 15 Mart Günlük First Call Dağılımı</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead className="text-right">First Call (FC)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { date: "8 Mart", fc: 0 },
                { date: "9 Mart", fc: 10 },
                { date: "10 Mart", fc: 8 },
                { date: "11 Mart", fc: 7 },
                { date: "12 Mart", fc: 7 },
                { date: "13 Mart", fc: 7 },
                { date: "14 Mart", fc: 0 },
                { date: "15 Mart", fc: 10 },
              ].map((day, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{day.date}</TableCell>
                  <TableCell className="text-right font-bold">{day.fc}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell className="font-bold">TOPLAM</TableCell>
                <TableCell className="text-right font-bold">49</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Daily Call Breakdown */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Günlük Çağrı Dağılımı</h2>
        <p className="text-sm text-muted-foreground">14 Şubat - 20 Şubat Günlük Toplam Çağrı Sayıları</p>
        <Card className="p-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyCallBreakdown}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-sm"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                className="text-sm"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Bar 
                dataKey="secondCall" 
                name="Second Call" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="firstCall" 
                name="First Call" 
                fill="hsl(var(--accent))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Toplam Second Call</p>
                <p className="text-2xl font-bold text-primary">17</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Toplam First Call</p>
                <p className="text-2xl font-bold text-accent">62</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Genel Toplam</p>
                <p className="text-2xl font-bold">79</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Call Duration Table */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Danışman Konuşma Süreleri</h2>
        <p className="text-sm text-muted-foreground">Toplam ve Ortalama Çağrı Süreleri</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Danışman</TableHead>
                <TableHead className="text-right">Çağrı Sayısı</TableHead>
                <TableHead className="text-right">Toplam Süre (dk)</TableHead>
                <TableHead className="text-right">Ortalama Süre (dk)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callDurations
                .sort((a, b) => b.calls - a.calls)
                .map((consultant, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{consultant.name}</TableCell>
                    <TableCell className="text-right">{consultant.calls}</TableCell>
                    <TableCell className="text-right">{consultant.totalDuration}</TableCell>
                    <TableCell className="text-right font-semibold">{consultant.avgDuration}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Team-Based Call Distribution */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Takım Bazlı Çağrı Dağılımı</h2>
        <p className="text-sm text-muted-foreground">Takımlara Göre First Call ve Second Call Dağılımı</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Takım</TableHead>
                <TableHead className="text-right">Toplam Çağrı</TableHead>
                <TableHead className="text-right">First Call</TableHead>
                <TableHead className="text-right">Second Call</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamDistribution.map((team, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{team.team}</TableCell>
                  <TableCell className="text-right font-bold">{team.totalCalls}</TableCell>
                  <TableCell className="text-right">{team.firstCall}</TableCell>
                  <TableCell className="text-right">{team.secondCall}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell className="font-bold">GENEL TOPLAM</TableCell>
                <TableCell className="text-right font-bold">56</TableCell>
                <TableCell className="text-right font-bold">6</TableCell>
                <TableCell className="text-right font-bold">50</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Consultant Call Distribution */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Danışman bazlı Çağrı Dağılımı</h2>
        <p className="text-sm text-muted-foreground">First Call ve Second Call Dağılımı</p>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Danışman</TableHead>
                <TableHead className="text-right">Toplam Çağrı</TableHead>
                <TableHead className="text-right">First Call</TableHead>
                <TableHead className="text-right">Second Call</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultantCallDistribution
                .sort((a, b) => b.totalCalls - a.totalCalls)
                .map((consultant, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{consultant.name}</TableCell>
                    <TableCell className="text-right font-bold">{consultant.totalCalls}</TableCell>
                    <TableCell className="text-right">{consultant.firstCall}</TableCell>
                    <TableCell className="text-right">{consultant.secondCall}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Package Gap Analysis */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Paket Anlatım Eksiklikleri</h2>
        <p className="text-sm text-muted-foreground">Danışmanların Anlatmadığı Paketler</p>
        <Card className="p-6 bg-warning/5 border-warning/20">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Danışman</TableHead>
                  <TableHead>Anlatılmayan Paket(ler)</TableHead>
                  <TableHead className="text-right">Eksik Anlatım Sayısı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packageGaps.map((gap, index) => {
                  const packages = gap.missingPackages.split(' ve ');
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{gap.name}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          {packages.map((pkg, idx) => (
                            <Badge 
                              key={idx}
                              variant="outline" 
                              className="bg-destructive/10 text-destructive border-destructive/30"
                            >
                              {pkg}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{gap.count}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 p-4 bg-destructive/10 rounded-lg border border-destructive/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                Toplam {packageGaps.reduce((sum, gap) => sum + gap.count, 0)} çağrıda paket anlatım eksikliği tespit edildi
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Unlistened Consultants */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Dinlenilemeyen Danışmanlar</h2>
        <p className="text-sm text-muted-foreground">Bu hafta çağrıları değerlendirilemeyen danışmanlar</p>
        <Card className="p-6 bg-muted/30">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {unlistenedConsultants.map((consultant, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 bg-background rounded-lg border"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span className="text-sm font-medium">{consultant.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{consultant.team}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Toplam <span className="font-semibold text-foreground">{unlistenedConsultants.length}</span> danışmanın çağrısı bu hafta dinlenemedi
            </p>
          </div>
        </Card>
      </div>
      </div>
    </div>
  );
};

export default WeeklyEvaluationReport;
