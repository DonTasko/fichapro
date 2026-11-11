# Base de dados (Supabase)

Projeto: `pqrqxvpzxqwblhxtmdns` (partilhado; tabelas do FichaPro com prefixo `fp_`).

| Tabela | Conteúdo |
|---|---|
| `fp_tenants` | Estabelecimentos (clientes). Plano: `trial` (30 dias), `active`, `past_due`, `canceled`; `paid_until`. |
| `fp_members` | Utilizadores de cada estabelecimento e função (`owner`, `admin`, `editor`, `viewer`). |
| `fp_invites` | Convites por email, aceites automaticamente quando a pessoa entra com esse email. |
| `fp_records` | Todos os dados da aplicação (ingredientes, fichas, histórico…), em JSON, por estabelecimento. Eliminação lógica (`deleted`) para sincronizar. |

Regras (RLS): cada utilizador só vê os estabelecimentos de que é membro; só `owner/admin/editor` gravam e
apenas com teste válido ou subscrição ativa. O plano só pode ser alterado com a chave de serviço (painel ou backend de pagamentos).

Ativar uma subscrição manualmente (SQL Editor):

```sql
update public.fp_tenants set plan = 'active', paid_until = now() + interval '1 year' where name = 'Nome do cliente';
```
