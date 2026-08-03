<script lang="ts">
import { defineComponent } from 'vue'

if (import.meta.client)
  throw new Error('BrokenRenderer fixture failed during module load')

export default defineComponent({})
</script>
