"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Topbar } from "@/components/layout/topbar";
import {
  Plus,
  FileText,
  Trash2,
  Copy,
  Loader2,
  CheckCircle2,
  Edit,
  Save,
  X,
} from "lucide-react";

interface Template {
  id: string;
  title: string;
  content: string;
  is_default: boolean;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const client = createClient();
    client
      .from("outreach_templates")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTemplates((data as Template[]) || []);
        setLoading(false);
      });
  }, []);

  async function loadTemplates() {
    const { data } = await supabase
      .from("outreach_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setTemplates((data as Template[]) || []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("outreach_templates").insert({
      user_id: user.id,
      title: newTitle.trim(),
      content: newContent.trim(),
    });

    setNewTitle("");
    setNewContent("");
    setShowCreate(false);
    setSaving(false);
    loadTemplates();
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    await supabase
      .from("outreach_templates")
      .update({ title: newTitle, content: newContent })
      .eq("id", id);
    setEditingId(null);
    setSaving(false);
    loadTemplates();
  }

  async function handleDelete(id: string) {
    await supabase.from("outreach_templates").delete().eq("id", id);
    loadTemplates();
  }

  function handleCopy(content: string, id: string) {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function startEdit(template: Template) {
    setEditingId(template.id);
    setNewTitle(template.title);
    setNewContent(template.content);
  }

  // Default templates to show as suggestions
  const defaultTemplates = [
    {
      title: "PR Package Request",
      content: `Hi [Brand Name],

I'm [Your Name], a content creator specializing in [Your Niche]. I love your products and would be thrilled to receive a PR package for review.

Here's what I can offer:
- [Number] posts on [Platform] (followers: [count])
- Honest, authentic content showcasing your products
- High-quality photos/videos

I'd love to discuss a potential collaboration. Looking forward to hearing from you!

Best,
[Your Name]`,
    },
    {
      title: "Brand Collaboration Pitch",
      content: `Hi [Brand Name] team,

I'm reaching out because I genuinely use and love [specific product]. As a [niche] creator with [follower count] engaged followers, I think we'd be a great fit for a collaboration.

My audience is primarily [demographics] and they're always asking for product recommendations in the [category] space.

Would you be open to sending a PR package for me to create content around? I'm happy to discuss deliverables and timeline.

Thanks,
[Your Name]`,
    },
    {
      title: "Campaign Offer (Brand to Creator)",
      content: `Hi [Creator Name],

We're [Brand Name], a [industry] company, and we've been following your content. Your style and audience align perfectly with our brand.

We'd like to offer you a PR package including:
- [List products]
- [Compensation if applicable]

In return, we'd love:
- [Deliverables: e.g., 1 Instagram post, 2 stories]
- [Timeline: e.g., within 2 weeks of receiving the package]

Interested? Let us know and we'll get the details sorted!

Best,
[Your Name] at [Brand Name]`,
    },
  ];

  return (
    <div>
      <Topbar accountType="creator" userName="" title="Outreach Templates" />

      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Your Templates</h2>
            <p className="text-sm text-muted-foreground">
              Save reusable message templates for outreach
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>

        {/* Create form */}
        {showCreate && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">New Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="Template name"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  placeholder="Write your template..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={6}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreate}
                  disabled={saving || !newTitle.trim() || !newContent.trim()}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreate(false);
                    setNewTitle("");
                    setNewContent("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Saved templates */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length > 0 ? (
          <div className="space-y-4">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardContent className="p-6">
                  {editingId === template.id ? (
                    <div className="space-y-4">
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                      />
                      <Textarea
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        rows={6}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUpdate(template.id)}
                          disabled={saving}
                        >
                          <Save className="mr-2 h-3 w-3" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="mr-2 h-3 w-3" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold">{template.title}</h3>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              handleCopy(template.content, template.id)
                            }
                          >
                            {copied === template.id ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEdit(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {template.content}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {/* Starter templates */}
        {templates.length === 0 && !loading && (
          <>
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                Get started with these template suggestions:
              </p>
            </div>
            <div className="space-y-4">
              {defaultTemplates.map((template, i) => (
                <Card key={i} className="border-dashed">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">{template.title}</h3>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNewTitle(template.title);
                          setNewContent(template.content);
                          setShowCreate(true);
                        }}
                      >
                        <Plus className="mr-2 h-3 w-3" />
                        Use this
                      </Button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-4">
                      {template.content}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
