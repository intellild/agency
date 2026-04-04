'use client';

import type { SubmitEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useServerConfig, type ServerConfig } from '@/stores/connection';

interface ServerConfigFormProps {
  initialConfig?: ServerConfig | null;
  onCancel?: () => void;
}

export function ServerConfigForm({ initialConfig, onCancel }: ServerConfigFormProps) {
  const [, setConfig] = useServerConfig();
  const [address, setAddress] = useState(initialConfig?.address ?? 'http://localhost:3000');
  const [publicKey, setPublicKey] = useState(initialConfig?.publicKey ?? '');

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    setConfig({
      address: address.trim(),
      publicKey: publicKey.trim(),
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>服务器配置</CardTitle>
          <CardDescription>
            请输入服务器地址和公钥以连接到 Agency 服务
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel>
                  <FieldTitle>服务器地址</FieldTitle>
                  <FieldDescription>Agency 后端服务的完整 URL</FieldDescription>
                </FieldLabel>
                <Input
                  type="url"
                  placeholder="http://localhost:3000"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel>
                  <FieldTitle>公钥</FieldTitle>
                  <FieldDescription>用于验证服务器身份的公钥</FieldDescription>
                </FieldLabel>
                <Input
                  type="text"
                  placeholder="输入公钥"
                  value={publicKey}
                  onChange={e => setPublicKey(e.target.value)}
                  required
                />
              </Field>
              <div className="flex gap-2 mt-2">
                <Button type="submit">保存配置</Button>
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel}>
                    取消
                  </Button>
                )}
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
